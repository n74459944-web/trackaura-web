/**
 * Admin review server actions.
 *
 * Target path: C:\dev\trackaura-web\app\admin\review\actions.ts
 *
 * This revision adds createChipFromProposal() — the Week 3 "Create new
 * chip" flow (ARCHITECTURE.md §10 Week 3). When the LLM returns
 * is_new_chip_proposal=true, the UI can call this to insert a new
 * gpu_chip canonical_entity and link the triggering board in one action.
 */

'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/auth';
import {
  suggestChipFromBoardName,
  type ChipCandidate,
} from '@/lib/llm/chip-suggest';

const SKIP_COOKIE = 'trackaura_review_skipped_gpu';
const SKIP_COOKIE_MAX_AGE = 60 * 60 * 24; // 1 day
const CANDIDATE_COUNT = 10;

type ChipMatch = {
  id: number;
  canonical_name: string;
  brand: string | null;
};

export type SuggestResult = {
  suggestion: {
    chip_name: string;
    confidence: number;
    reasoning: string;
    is_new_chip_proposal: boolean;
  };
  matches: ChipMatch[];
  candidates_shown: ChipMatch[];
};

// ---------------------------------------------------------------------
// approveParent — existing, unchanged
// ---------------------------------------------------------------------
export async function approveParent(boardId: number, chipId: number) {
  await requireAdmin();

  const supabase = createAdminClient();

  const { data: chip, error: chipErr } = await supabase
    .from('canonical_entities')
    .select('id, entity_type')
    .eq('id', chipId)
    .maybeSingle();

  if (chipErr) throw new Error(`approveParent verify chip: ${chipErr.message}`);
  if (!chip) throw new Error(`approveParent: chip ${chipId} not found`);
  if (chip.entity_type !== 'gpu_chip') {
    throw new Error(
      `approveParent: entity ${chipId} is ${chip.entity_type}, expected gpu_chip`,
    );
  }

  const { error: updateErr } = await supabase
    .from('canonical_entities')
    .update({
      parent_entity_id: chipId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', boardId)
    .eq('entity_type', 'gpus');

  if (updateErr) {
    throw new Error(`approveParent update: ${updateErr.message}`);
  }

  revalidatePath('/admin/review');
}

// ---------------------------------------------------------------------
// skipBoard / restartQueue — existing, unchanged
// ---------------------------------------------------------------------
export async function skipBoard(boardId: number) {
  await requireAdmin();

  const cookieStore = await cookies();
  const existing = cookieStore.get(SKIP_COOKIE)?.value ?? '';
  const skipped = new Set(existing.split(',').filter(Boolean));
  skipped.add(String(boardId));

  cookieStore.set(SKIP_COOKIE, Array.from(skipped).join(','), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/admin',
    maxAge: SKIP_COOKIE_MAX_AGE,
  });

  revalidatePath('/admin/review');
}

export async function restartQueue() {
  await requireAdmin();
  const cookieStore = await cookies();
  cookieStore.delete(SKIP_COOKIE);
  revalidatePath('/admin/review');
}

// ---------------------------------------------------------------------
// suggestChip — candidate-aware tier-3 (ARCHITECTURE.md §4 Tier 3)
// ---------------------------------------------------------------------
export async function suggestChip(
  boardId: number,
  boardName: string,
): Promise<SuggestResult> {
  await requireAdmin();

  const supabase = createAdminClient();

  const { data: rawCandidates, error: candErr } = await supabase.rpc(
    'search_gpu_chip_candidates',
    { query_text: boardName, max_results: CANDIDATE_COUNT },
  );

  if (candErr) {
    throw new Error(`suggestChip candidate search: ${candErr.message}`);
  }

  const candidateList: ChipCandidate[] = (
    (rawCandidates ?? []) as Array<{
      id: number;
      canonical_name: string;
      brand: string | null;
    }>
  ).map((c) => ({
    id: c.id,
    canonical_name: c.canonical_name,
    brand: c.brand,
  }));

  const candidates_shown: ChipMatch[] = candidateList.map((c) => ({
    id: c.id,
    canonical_name: c.canonical_name,
    brand: c.brand,
  }));

  const suggestion = await suggestChipFromBoardName(boardName, candidateList);

  let matches: ChipMatch[] = [];
  let display_chip_name = '';
  let is_new_chip_proposal = false;

  if (suggestion.matched_chip_id !== null) {
    const matched = candidateList.find(
      (c) => c.id === suggestion.matched_chip_id,
    );
    if (matched) {
      matches = [
        {
          id: matched.id,
          canonical_name: matched.canonical_name,
          brand: matched.brand,
        },
      ];
      display_chip_name = matched.canonical_name;
    }
  } else if (suggestion.new_chip_proposal) {
    display_chip_name = suggestion.new_chip_proposal.chip_name;
    is_new_chip_proposal = true;
  }

  console.log(
    `[llm-suggest] board=${boardId} name="${boardName}" ` +
      `→ matched_id=${suggestion.matched_chip_id} ` +
      `proposal="${suggestion.new_chip_proposal?.chip_name ?? ''}" ` +
      `conf=${suggestion.confidence} candidates=${candidateList.length}`,
  );

  return {
    suggestion: {
      chip_name: display_chip_name,
      confidence: suggestion.confidence,
      reasoning: suggestion.reasoning,
      is_new_chip_proposal,
    },
    matches,
    candidates_shown,
  };
}

// ---------------------------------------------------------------------
// createChipFromProposal — Week 3 "Create new chip" flow
// ---------------------------------------------------------------------

type CreateChipResult = {
  chipId: number;
  wasCreated: boolean; // false when we detected an existing chip and reused it
};

/**
 * Insert a new gpu_chip canonical_entity based on an LLM/user proposal,
 * link the triggering board as its child, and return the new chip id.
 *
 * Idempotent on canonical_name (case-insensitive): if a gpu_chip with the
 * same name already exists, we reuse it instead of creating a duplicate.
 * This protects against double-click races and the "LLM proposed a chip
 * we actually have under a slightly different candidate ranking" case.
 *
 * Provenance: an entity_source_mappings row tagged admin_review is
 * written so we can later audit which chips came from the review UI vs
 * catalog imports.
 */
export async function createChipFromProposal(
  boardId: number,
  proposedChipName: string,
  reasoning: string,
): Promise<CreateChipResult> {
  await requireAdmin();

  const name = proposedChipName.trim();
  if (!name) throw new Error('createChipFromProposal: empty chip name');
  if (name.length > 200) {
    throw new Error('createChipFromProposal: chip name exceeds 200 chars');
  }

  const supabase = createAdminClient();

  // Verify the board exists and is a gpu board
  const { data: board, error: boardErr } = await supabase
    .from('canonical_entities')
    .select('id, entity_type, canonical_name')
    .eq('id', boardId)
    .maybeSingle();

  if (boardErr) throw new Error(`verify board: ${boardErr.message}`);
  if (!board) throw new Error(`createChipFromProposal: board ${boardId} not found`);
  if (board.entity_type !== 'gpus') {
    throw new Error(
      `createChipFromProposal: entity ${boardId} is ${board.entity_type}, expected gpus`,
    );
  }

  // Check for existing chip with the same name (case-insensitive).
  // This is our defence against duplicates from double-submits or
  // LLM proposals that happen to match an existing chip we didn't
  // surface as a top-10 candidate.
  const { data: existing, error: existingErr } = await supabase
    .from('canonical_entities')
    .select('id, canonical_name')
    .eq('entity_type', 'gpu_chip')
    .ilike('canonical_name', name)
    .limit(1)
    .maybeSingle();

  if (existingErr) {
    throw new Error(`lookup existing chip: ${existingErr.message}`);
  }

  let chipId: number;
  let wasCreated = false;

  if (existing) {
    chipId = existing.id;
    console.log(
      `[create-chip] board=${boardId} proposed="${name}" reusing existing chip id=${chipId}`,
    );
  } else {
    const sourceId = await ensureAdminReviewSource(supabase);
    const slug = slugify(name);
    const brand = parseBrand(name);

    const { data: newChip, error: insertErr } = await supabase
      .from('canonical_entities')
      .insert({
        slug,
        canonical_name: name,
        vertical: 'electronics',
        entity_type: 'gpu_chip',
        parent_entity_id: null,
        brand,
      })
      .select('id')
      .single();

    if (insertErr) {
      throw new Error(`create chip entity: ${insertErr.message}`);
    }
    chipId = newChip.id;
    wasCreated = true;

    const { error: mapErr } = await supabase
      .from('entity_source_mappings')
      .insert({
        entity_id: chipId,
        source_id: sourceId,
        external_id: `board-${boardId}`,
        confidence: 1.0,
        verified_by_human: true,
      });

    if (mapErr) {
      // Don't fail the whole action on provenance logging failure —
      // the chip exists, just surface a warning.
      console.error(
        `[create-chip] chip ${chipId} created but source mapping failed: ${mapErr.message}`,
      );
    }

    console.log(
      `[create-chip] board=${boardId} created chip id=${chipId} name="${name}" brand=${brand} ` +
        `slug=${slug} reasoning="${reasoning.slice(0, 200)}"`,
    );
  }

  // Link the triggering board to the chip
  const { error: linkErr } = await supabase
    .from('canonical_entities')
    .update({
      parent_entity_id: chipId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', boardId)
    .eq('entity_type', 'gpus');

  if (linkErr) {
    throw new Error(`link board to new chip: ${linkErr.message}`);
  }

  revalidatePath('/admin/review');

  return { chipId, wasCreated };
}

// ---------------------------------------------------------------------
// Helpers (local to this module)
// ---------------------------------------------------------------------

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Parse the brand from a canonical chip name.
 * Returns NVIDIA / AMD / Intel (matching existing catalog casing) or null.
 */
function parseBrand(name: string): string | null {
  const first = name.trim().split(/\s+/)[0]?.toUpperCase();
  if (first === 'NVIDIA') return 'NVIDIA';
  if (first === 'AMD') return 'AMD';
  if (first === 'INTEL') return 'Intel';
  return null;
}

/**
 * Ensure a catalog_sources row exists for admin-review-created entities.
 * Upserts lazily on first call. Returns the source id.
 */
async function ensureAdminReviewSource(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<number> {
  const { data: existing, error: lookupErr } = await supabase
    .from('catalog_sources')
    .select('id')
    .eq('name', 'admin_review')
    .eq('vertical', 'electronics')
    .limit(1)
    .maybeSingle();

  if (lookupErr) {
    throw new Error(`ensureAdminReviewSource lookup: ${lookupErr.message}`);
  }
  if (existing) return existing.id;

  const { data: created, error: insertErr } = await supabase
    .from('catalog_sources')
    .insert({
      name: 'admin_review',
      vertical: 'electronics',
      kind: 'manual',
      notes:
        'Entities created through the /admin/review UI when no catalog source covered the item.',
    })
    .select('id')
    .single();

  if (insertErr) {
    throw new Error(`ensureAdminReviewSource insert: ${insertErr.message}`);
  }
  return created.id;
}
