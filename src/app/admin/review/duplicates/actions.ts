'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/auth';

/**
 * Server actions for /admin/review/duplicates.
 *
 * Schema confirmed against information_schema.columns + pg_constraint
 * 2026-04-25:
 *   id                 bigint  PK
 *   a_entity_id        bigint  FK canonical_entities ON DELETE CASCADE
 *   b_entity_id        bigint  FK canonical_entities ON DELETE CASCADE
 *   similarity         numeric (0..1)
 *   priority           integer (UPC-bypass = 100; sim*100 for name-bypass)
 *   status             text    CHECK in
 *                              ('pending'|'merged'|'rejected_not_duplicate'
 *                              |'skipped'|'stale')
 *   decided_at         timestamptz   (NULL iff status='pending')
 *   decided_by         text
 *   decision_notes     text
 *   merged_into_entity_id bigint FK canonical_entities ON DELETE SET NULL
 *   pair_ordered: a_entity_id < b_entity_id
 *
 * RPC: merge_canonical_entity(p_source_id bigint, p_target_id bigint,
 *                             p_actor text DEFAULT NULL) RETURNS jsonb
 *
 * Five decision paths:
 *   mergeKeepA               — RPC merge(b -> a), pair row cascade-deleted
 *   mergeKeepB               — RPC merge(a -> b), pair row cascade-deleted
 *   rejectNotDuplicate       — flip status, keep both entities
 *   skipDuplicate            — defer for this session via cookie
 *   restartDuplicatesQueue   — clear the skip cookie
 *
 * On merge: a_entity_id and b_entity_id are ON DELETE CASCADE, so deleting
 * the source canonical_entity auto-cleans this pair row (and any other
 * pending pair involving the source). We deliberately do NOT update the
 * row to status='merged' before calling merge — that would race the
 * cascade and violate the decided_rows_have_decision_timestamp invariant
 * if the merge fails.
 *
 * Audit lives in the canonical_entity_merges table (one row per merge),
 * written by merge_canonical_entity v2 inside the same transaction as
 * the source delete. Captures source/target names + slugs as text
 * snapshots and the full per-table row-count summary as JSONB. Verified
 * 2026-04-25: legacy_source_db (which the bible cited as the audit
 * mechanism) does not exist on canonical_entities; that column is on
 * the deprecated canonical_products table only.
 *
 * All writes go through the service-role admin client (bypasses RLS).
 */

const SKIP_COOKIE = 'trackaura_admin_skipped_duplicates';
const SKIP_COOKIE_MAX_AGE = 60 * 60 * 24; // 1 day
const REVIEW_PATH = '/admin/review/duplicates';

type AdminClient = ReturnType<typeof createAdminClient>;

interface PairRow {
  id: number;
  a_entity_id: number;
  b_entity_id: number;
  status: string;
}

// -------------------------------------------------------------------------
// 1. Merge: keep A, delete B  (source = B, target = A)
// -------------------------------------------------------------------------
export async function mergeKeepA(formData: FormData) {
  await requireAdmin();
  const pairId = parseRequiredInt(formData, 'pair_id');
  const supabase = createAdminClient();
  const pair = await loadPair(supabase, pairId);
  await callMerge(supabase, pair.b_entity_id, pair.a_entity_id);
  revalidatePath(REVIEW_PATH);
}

// -------------------------------------------------------------------------
// 2. Merge: keep B, delete A  (source = A, target = B)
// -------------------------------------------------------------------------
export async function mergeKeepB(formData: FormData) {
  await requireAdmin();
  const pairId = parseRequiredInt(formData, 'pair_id');
  const supabase = createAdminClient();
  const pair = await loadPair(supabase, pairId);
  await callMerge(supabase, pair.a_entity_id, pair.b_entity_id);
  revalidatePath(REVIEW_PATH);
}

// -------------------------------------------------------------------------
// 3. Not a duplicate — flip status, preserve both entities
// -------------------------------------------------------------------------
export async function rejectNotDuplicate(formData: FormData) {
  await requireAdmin();

  const pairId = parseRequiredInt(formData, 'pair_id');
  const reason =
    ((formData.get('reason') as string) ?? 'other').trim() || 'other';
  const validReasons = new Set([
    'legitimate_variants',
    'different_chips',
    'false_positive',
    'needs_more_data',
    'other',
  ]);
  const safeReason = validReasons.has(reason) ? reason : 'other';

  const supabase = createAdminClient();
  await loadPair(supabase, pairId); // status='pending' validation only

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('duplicate_canonical_pairs')
    .update({
      status: 'rejected_not_duplicate',
      decided_at: now,
      decided_by: 'admin',
      decision_notes: `rejected_${safeReason}`,
      updated_at: now,
    })
    .eq('id', pairId);
  if (error) {
    throw new Error(`rejectNotDuplicate: ${error.message}`);
  }

  revalidatePath(REVIEW_PATH);
}

// -------------------------------------------------------------------------
// 4. Skip for session — append pair id to cookie, no DB write
// -------------------------------------------------------------------------
export async function skipDuplicate(formData: FormData) {
  await requireAdmin();

  const pairId = parseRequiredInt(formData, 'pair_id');

  const cookieStore = await cookies();
  const existing = cookieStore.get(SKIP_COOKIE)?.value ?? '';
  const skipped = new Set(existing.split(',').filter(Boolean));
  skipped.add(String(pairId));

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
// 5. Restart queue — clear skip cookie
// -------------------------------------------------------------------------
export async function restartDuplicatesQueue() {
  await requireAdmin();
  const cookieStore = await cookies();
  cookieStore.delete(SKIP_COOKIE);
  revalidatePath(REVIEW_PATH);
}

// =========================================================================
// Internal helpers
// =========================================================================

async function loadPair(
  supabase: AdminClient,
  pairId: number,
): Promise<PairRow> {
  const { data, error } = await supabase
    .from('duplicate_canonical_pairs')
    .select('id, a_entity_id, b_entity_id, status')
    .eq('id', pairId)
    .maybeSingle();

  if (error) {
    throw new Error(`loadPair: ${error.message}`);
  }
  if (!data) {
    throw new Error(`loadPair: pair ${pairId} not found`);
  }
  if (data.status !== 'pending') {
    throw new Error(
      `loadPair: pair ${pairId} status is ${data.status}, expected pending`,
    );
  }
  return data as PairRow;
}

async function callMerge(
  supabase: AdminClient,
  sourceId: number,
  targetId: number,
): Promise<void> {
  if (sourceId === targetId) {
    throw new Error(
      `callMerge: source and target are identical (${sourceId})`,
    );
  }

  const { data, error } = await supabase.rpc('merge_canonical_entity', {
    p_source_id: sourceId,
    p_target_id: targetId,
    p_actor: 'admin:duplicates_review',
  });
  if (error) {
    throw new Error(
      `merge_canonical_entity(${sourceId} -> ${targetId}): ${error.message}`,
    );
  }

  // JSONB summary of rows moved/dropped per table; also persisted to
  // canonical_entity_merges by the function. Logged here for live
  // operator confidence during merge sessions.
  // eslint-disable-next-line no-console
  console.log(
    `[duplicates] merged ${sourceId} -> ${targetId}:`,
    JSON.stringify(data),
  );
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
