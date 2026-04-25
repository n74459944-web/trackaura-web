'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/auth';

/**
 * Server actions for /admin/review/boards.
 *
 * Schema confirmed against information_schema.columns 2026-04-24:
 *   status              text   ('pending' | 'approved' | 'rejected')
 *   decision_notes      text   (free-form outcome label)
 *   resolved_board_id   bigint (FK canonical_entities, the resolved board)
 *   decided_at          timestamptz
 *   decided_by          text
 *
 * Four decision paths:
 *   linkExistingBoard  — write listing under chosen candidate, mark approved
 *   createNewBoard     — create canonical_entities + attrs, then link
 *   rejectProposal     — mark rejected, write nothing to new schema
 *   skipBoardProposal  — defer for this session via cookie, no DB change
 *
 * Plus restartBoardQueue() to clear the skip cookie.
 *
 * All writes go through the service-role admin client (bypasses RLS).
 */

const SKIP_COOKIE = 'trackaura_admin_skipped_boards';
const SKIP_COOKIE_MAX_AGE = 60 * 60 * 24; // 1 day
const REVIEW_PATH = '/admin/review/boards';

// -------------------------------------------------------------------------
// 1. Link to an existing candidate board
// -------------------------------------------------------------------------
export async function linkExistingBoard(formData: FormData) {
  await requireAdmin();

  const proposalId = parseRequiredInt(formData, 'proposal_id');
  const boardId = parseRequiredInt(formData, 'board_id');

  const supabase = createAdminClient();
  const proposal = await loadProposal(supabase, proposalId);

  // Sanity: chosen board must exist as a 'gpus' entity
  const { data: board, error: boardErr } = await supabase
    .from('canonical_entities')
    .select('id, entity_type')
    .eq('id', boardId)
    .maybeSingle();
  if (boardErr) {
    throw new Error(`linkExistingBoard board lookup: ${boardErr.message}`);
  }
  if (!board) {
    throw new Error(`linkExistingBoard: board ${boardId} not found`);
  }
  if (board.entity_type !== 'gpus') {
    throw new Error(
      `linkExistingBoard: entity ${boardId} is type ${board.entity_type}, expected 'gpus'`,
    );
  }

  await writeListingAndObservation(supabase, {
    entityId: boardId,
    proposal,
    matchConfidence: 1.0,
    matchSource: 'human',
  });

  await applyDecision(supabase, proposalId, {
    notes: 'linked_existing',
    boardId,
  });

  revalidatePath(REVIEW_PATH);
}

// -------------------------------------------------------------------------
// 2. Create a new board canonical_entity, then link
// -------------------------------------------------------------------------
export async function createNewBoard(formData: FormData) {
  await requireAdmin();

  const proposalId = parseRequiredInt(formData, 'proposal_id');
  const chipId = parseRequiredInt(formData, 'chip_id');
  const canonicalName = ((formData.get('canonical_name') as string) ?? '').trim();
  const brand = ((formData.get('brand') as string) ?? '').trim() || null;
  const memoryGbRaw = (formData.get('memory_gb') as string) ?? '';
  const productLine =
    ((formData.get('product_line') as string) ?? '').trim() || null;

  if (!canonicalName) {
    throw new Error('createNewBoard: canonical_name is required');
  }

  const memoryGb = memoryGbRaw.trim() === '' ? null : Number(memoryGbRaw);
  if (memoryGb !== null && !Number.isFinite(memoryGb)) {
    throw new Error(`createNewBoard: memory_gb invalid: ${memoryGbRaw}`);
  }

  const supabase = createAdminClient();
  const proposal = await loadProposal(supabase, proposalId);

  // Validate parent chip
  const { data: chip, error: chipErr } = await supabase
    .from('canonical_entities')
    .select('id, entity_type')
    .eq('id', chipId)
    .maybeSingle();
  if (chipErr) {
    throw new Error(`createNewBoard chip lookup: ${chipErr.message}`);
  }
  if (!chip) {
    throw new Error(`createNewBoard: chip ${chipId} not found`);
  }
  if (chip.entity_type !== 'gpu_chip') {
    throw new Error(
      `createNewBoard: entity ${chipId} is type ${chip.entity_type}, expected 'gpu_chip'`,
    );
  }

  const slug = await ensureUniqueSlug(supabase, slugify(canonicalName));
  const now = new Date().toISOString();

  // Insert canonical_entities row
  const { data: inserted, error: insErr } = await supabase
    .from('canonical_entities')
    .insert({
      slug,
      canonical_name: canonicalName,
      vertical: 'electronics',
      entity_type: 'gpus',
      parent_entity_id: chipId,
      brand,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();
  if (insErr || !inserted) {
    throw new Error(
      `createNewBoard insert canonical_entities: ${
        insErr?.message ?? 'no row returned'
      }`,
    );
  }
  const newBoardId = inserted.id as number;

  // Insert price-defining attributes per §3 variant rule
  const attrs: AttrRow[] = [];
  if (memoryGb !== null) {
    attrs.push({
      entity_id: newBoardId,
      attribute_key: 'memory_gb',
      attribute_value: String(memoryGb),
      attribute_value_num: memoryGb,
      is_price_defining: true,
    });
  }
  if (productLine) {
    attrs.push({
      entity_id: newBoardId,
      attribute_key: 'product_line',
      attribute_value: productLine,
      attribute_value_num: null,
      is_price_defining: false,
    });
  }
  if (attrs.length > 0) {
    const { error: attrErr } = await supabase
      .from('entity_attributes')
      .insert(attrs);
    if (attrErr) {
      throw new Error(
        `createNewBoard insert entity_attributes: ${attrErr.message}`,
      );
    }
  }

  // Wire the listing + observation
  await writeListingAndObservation(supabase, {
    entityId: newBoardId,
    proposal,
    matchConfidence: 1.0,
    matchSource: 'human',
  });

  await applyDecision(supabase, proposalId, {
    notes: 'created_new',
    boardId: newBoardId,
  });

  revalidatePath(REVIEW_PATH);
}

// -------------------------------------------------------------------------
// 3. Reject — mark proposal rejected, write nothing
// -------------------------------------------------------------------------
export async function rejectProposal(formData: FormData) {
  await requireAdmin();

  const proposalId = parseRequiredInt(formData, 'proposal_id');
  const reason = ((formData.get('reason') as string) ?? 'other').trim() || 'other';
  const validReasons = new Set([
    'not_a_gpu',
    'duplicate_existing',
    'scraper_error',
    'wrong_chip',
    'other',
  ]);
  const safeReason = validReasons.has(reason) ? reason : 'other';

  const supabase = createAdminClient();
  await applyDecision(supabase, proposalId, {
    notes: `rejected_${safeReason}`,
    boardId: null,
    status: 'rejected',
  });

  revalidatePath(REVIEW_PATH);
}

// -------------------------------------------------------------------------
// 4. Skip for session — append to cookie, no DB write
// -------------------------------------------------------------------------
export async function skipBoardProposal(formData: FormData) {
  await requireAdmin();

  const proposalId = parseRequiredInt(formData, 'proposal_id');

  const cookieStore = await cookies();
  const existing = cookieStore.get(SKIP_COOKIE)?.value ?? '';
  const skipped = new Set(existing.split(',').filter(Boolean));
  skipped.add(String(proposalId));

  cookieStore.set(SKIP_COOKIE, Array.from(skipped).join(','), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/admin',
    maxAge: SKIP_COOKIE_MAX_AGE,
  });

  revalidatePath(REVIEW_PATH);
}

// -------------------------------------------------------------------------
// 5. Restart queue — clear the session skip cookie
// -------------------------------------------------------------------------
export async function restartBoardQueue() {
  await requireAdmin();
  const cookieStore = await cookies();
  cookieStore.delete(SKIP_COOKIE);
  revalidatePath(REVIEW_PATH);
}

// =========================================================================
// Internal helpers
// =========================================================================

interface ProposalRow {
  id: number;
  retailer: string;
  url: string;
  retailer_sku: string | null;
  raw_title: string;
  brand: string | null;
  price_cad: number | null;
  scraped_at: string | null;
  source_product_id: number | null;
  proposed_chip_id: number;
  status: string;
}

interface AttrRow {
  entity_id: number;
  attribute_key: string;
  attribute_value: string;
  attribute_value_num: number | null;
  is_price_defining: boolean;
}

interface DecisionPatch {
  notes: string;
  boardId: number | null;
  status?: 'approved' | 'rejected';
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function loadProposal(
  supabase: AdminClient,
  proposalId: number,
): Promise<ProposalRow> {
  const { data, error } = await supabase
    .from('pending_board_proposals')
    .select(
      'id, retailer, url, retailer_sku, raw_title, brand, price_cad, scraped_at, source_product_id, proposed_chip_id, status',
    )
    .eq('id', proposalId)
    .maybeSingle();

  if (error) {
    throw new Error(`loadProposal: ${error.message}`);
  }
  if (!data) {
    throw new Error(`loadProposal: proposal ${proposalId} not found`);
  }
  if (data.status !== 'pending') {
    throw new Error(
      `loadProposal: proposal ${proposalId} status is ${data.status}, expected pending`,
    );
  }
  return data as ProposalRow;
}

async function writeListingAndObservation(
  supabase: AdminClient,
  args: {
    entityId: number;
    proposal: ProposalRow;
    matchConfidence: number;
    matchSource: string;
  },
): Promise<void> {
  const { entityId, proposal, matchConfidence, matchSource } = args;
  const now = new Date().toISOString();
  const firstSeen = proposal.scraped_at ?? now;

  // If a listing for (retailer, url) already exists, fold into it
  const { data: existing, error: existingErr } = await supabase
    .from('listings')
    .select('id')
    .eq('retailer', proposal.retailer)
    .eq('url', proposal.url)
    .maybeSingle();
  if (existingErr) {
    throw new Error(`writeListing existing lookup: ${existingErr.message}`);
  }

  let listingId: number;
  if (existing) {
    listingId = existing.id as number;
    const { error: updErr } = await supabase
      .from('listings')
      .update({
        entity_id: entityId,
        last_seen: firstSeen,
        is_active: true,
        match_confidence: matchConfidence,
        match_source: matchSource,
      })
      .eq('id', listingId);
    if (updErr) {
      throw new Error(`writeListing update: ${updErr.message}`);
    }
  } else {
    const { data: ins, error: insErr } = await supabase
      .from('listings')
      .insert({
        entity_id: entityId,
        retailer: proposal.retailer,
        retailer_sku: proposal.retailer_sku,
        url: proposal.url,
        first_seen: firstSeen,
        last_seen: firstSeen,
        is_active: true,
        match_confidence: matchConfidence,
        match_source: matchSource,
        country_code: 'CA',
      })
      .select('id')
      .single();
    if (insErr || !ins) {
      throw new Error(
        `writeListing insert: ${insErr?.message ?? 'no row returned'}`,
      );
    }
    listingId = ins.id as number;
  }

  // Observation if we have a price
  if (proposal.price_cad !== null && proposal.price_cad !== undefined) {
    const { error: obsErr } = await supabase
      .from('price_observations')
      .insert({
        listing_id: listingId,
        entity_id: entityId,
        price: proposal.price_cad,
        currency: 'CAD',
        is_in_stock: true,
        is_openbox: false,
        observed_at: firstSeen,
      });
    if (obsErr) {
      throw new Error(`writeObservation insert: ${obsErr.message}`);
    }
  }
}

async function applyDecision(
  supabase: AdminClient,
  proposalId: number,
  patch: DecisionPatch,
): Promise<void> {
  const updateRow = {
    status: patch.status ?? 'approved',
    decision_notes: patch.notes,
    resolved_board_id: patch.boardId,
    decided_at: new Date().toISOString(),
    decided_by: 'admin',
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from('pending_board_proposals')
    .update(updateRow)
    .eq('id', proposalId);
  if (error) {
    throw new Error(`applyDecision: ${error.message}`);
  }
}

function parseRequiredInt(formData: FormData, key: string): number {
  const raw = formData.get(key);
  if (raw === null) {
    throw new Error(`Missing form field: ${key}`);
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error(`Form field ${key} is not an integer: ${String(raw)}`);
  }
  return n;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 200) || 'unnamed-board'
  );
}

async function ensureUniqueSlug(
  supabase: AdminClient,
  base: string,
): Promise<string> {
  const { data: collision, error } = await supabase
    .from('canonical_entities')
    .select('slug')
    .eq('slug', base)
    .maybeSingle();
  if (error) {
    throw new Error(`ensureUniqueSlug lookup: ${error.message}`);
  }
  if (!collision) return base;

  for (let i = 2; i <= 50; i++) {
    const candidate = `${base}-${i}`.slice(0, 200);
    const { data: row, error: e } = await supabase
      .from('canonical_entities')
      .select('slug')
      .eq('slug', candidate)
      .maybeSingle();
    if (e) {
      throw new Error(`ensureUniqueSlug retry ${i}: ${e.message}`);
    }
    if (!row) return candidate;
  }
  throw new Error(`ensureUniqueSlug: exhausted suffixes 2-50 for base ${base}`);
}
