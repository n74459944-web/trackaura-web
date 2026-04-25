import Link from 'next/link';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/auth';
import { DuplicateActionPanel } from './duplicate-action-panel';
import { restartDuplicatesQueue } from './actions';

/**
 * /admin/review/duplicates
 *
 * Per ARCHITECTURE.md §10 and §12. Consumes the `duplicate_canonical_pairs`
 * queue produced by `detect_duplicate_canonicals()` (v2: UPC-bypass + digit-
 * sequence rules, shipped 2026-04-25).
 *
 * Sibling of /admin/review (chips) and /admin/review/boards. Same shared-
 * secret auth, same skip-via-cookie pattern, three decision paths:
 *
 *   1. Merge: keep A, delete B  -> RPC merge_canonical_entity(b, a, ...)
 *   2. Merge: keep B, delete A  -> RPC merge_canonical_entity(a, b, ...)
 *   3. Not a duplicate          -> flip status to rejected_not_duplicate
 *
 * Plus skip-for-session via cookie.
 *
 * Note on cascade behavior: a_entity_id and b_entity_id FKs are ON DELETE
 * CASCADE. When the merge RPC deletes the source canonical_entity, the
 * cascade auto-cleans this pair row (and any other pending pair involving
 * the source). We do NOT write status='merged' before calling merge —
 * that would race the cascade. Audit lives on the survivor's
 * legacy_source_db = 'merged_into:<source_id>'.
 */

export const dynamic = 'force-dynamic';

const SKIP_COOKIE = 'trackaura_admin_skipped_duplicates';

interface PendingPair {
  id: number;
  a_entity_id: number;
  b_entity_id: number;
  similarity: number;
  detection_run_id: string | null;
  detected_at: string;
  a_canonical_name: string;
  b_canonical_name: string;
  a_listings_count: number;
  b_listings_count: number;
  a_price_obs_count: number;
  b_price_obs_count: number;
  status: string;
  priority: number;
  created_at: string;
}

interface QueueStats {
  pending_count: number;
  aged_over_7d: number;
  aged_over_30d: number;
  very_high_similarity: number;
  high_similarity: number;
  distinct_entities_in_queue: number;
}

async function fetchSkippedIds(): Promise<number[]> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SKIP_COOKIE)?.value ?? '';
  return raw
    .split(',')
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
}

async function fetchQueueStats(): Promise<QueueStats> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('v_duplicate_canonical_pairs_stats')
    .select(
      'pending_count, aged_over_7d, aged_over_30d, very_high_similarity, high_similarity, distinct_entities_in_queue',
    )
    .maybeSingle();

  if (error) {
    throw new Error(`fetchQueueStats: ${error.message}`);
  }
  return (
    (data as QueueStats | null) ?? {
      pending_count: 0,
      aged_over_7d: 0,
      aged_over_30d: 0,
      very_high_similarity: 0,
      high_similarity: 0,
      distinct_entities_in_queue: 0,
    }
  );
}

async function fetchNextPair(
  skippedIds: number[],
): Promise<PendingPair | null> {
  const supabase = createAdminClient();
  let query = supabase
    .from('duplicate_canonical_pairs')
    .select('*')
    .eq('status', 'pending')
    // UPC-bypass first (priority=100), then highest similarity, then oldest
    .order('priority', { ascending: false })
    .order('similarity', { ascending: false })
    .order('id', { ascending: true })
    .limit(1);

  if (skippedIds.length > 0) {
    query = query.not('id', 'in', `(${skippedIds.join(',')})`);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(`fetchNextPair: ${error.message}`);
  }
  return (data as PendingPair | null) ?? null;
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('en-CA', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return ts;
  }
}

export default async function ReviewDuplicatesPage() {
  await requireAdmin();

  const skippedIds = await fetchSkippedIds();
  const [stats, pair] = await Promise.all([
    fetchQueueStats(),
    fetchNextPair(skippedIds),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-slate-100">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-teal-400">
            Duplicate canonicals review
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            <Link href="/admin/review" className="hover:text-teal-400">
              ← chip review
            </Link>
            <span className="mx-2 text-slate-600">·</span>
            <Link
              href="/admin/review/boards"
              className="hover:text-teal-400"
            >
              board review
            </Link>
          </p>
        </div>
        <div className="text-right text-sm">
          <div className="font-mono text-teal-400">
            {stats.pending_count} pending
          </div>
          {skippedIds.length > 0 && (
            <form action={restartDuplicatesQueue}>
              <button
                type="submit"
                className="mt-1 text-xs text-slate-500 hover:text-slate-300"
              >
                {skippedIds.length} skipped this session — clear
              </button>
            </form>
          )}
        </div>
      </header>

      <section className="mb-8 rounded-md border border-slate-800 bg-slate-900/50 p-4 text-xs">
        <div className="mb-2 font-mono uppercase tracking-wider text-slate-500">
          Queue breakdown
        </div>
        <div className="grid grid-cols-3 gap-4 text-slate-300">
          <div>
            <div className="mb-1 text-slate-500">By similarity</div>
            <div className="font-mono">
              ≥0.95: {stats.very_high_similarity}
            </div>
            <div className="font-mono">
              0.90–0.95: {stats.high_similarity}
            </div>
          </div>
          <div>
            <div className="mb-1 text-slate-500">Aging</div>
            <div className="font-mono">over 7d: {stats.aged_over_7d}</div>
            <div className="font-mono">over 30d: {stats.aged_over_30d}</div>
          </div>
          <div>
            <div className="mb-1 text-slate-500">Footprint</div>
            <div className="font-mono">
              distinct entities: {stats.distinct_entities_in_queue}
            </div>
          </div>
        </div>
      </section>

      {!pair ? (
        <div className="rounded-md border border-slate-800 bg-slate-900/50 p-8 text-center">
          <div className="text-lg text-teal-400">Queue empty</div>
          <p className="mt-2 text-sm text-slate-400">
            All pending duplicate pairs have been reviewed or skipped.
            {skippedIds.length > 0 &&
              ' Clear the skip list above to revisit skipped pairs.'}
          </p>
        </div>
      ) : (
        <>
          <section className="mb-6 rounded-md border border-slate-800 bg-slate-900/50 p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-sm text-slate-500">
                  Pair #{pair.id}
                </span>
                {pair.priority > 0 && (
                  <span className="font-mono text-xs text-amber-300">
                    priority={pair.priority}
                    {pair.priority === 100 && (
                      <span className="ml-1 text-amber-200">
                        (UPC bypass)
                      </span>
                    )}
                  </span>
                )}
              </div>
              <div className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs uppercase tracking-wider text-amber-400">
                similarity {Number(pair.similarity).toFixed(3)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-400">
              <div>
                <span className="text-slate-500">detected:</span>{' '}
                <span className="font-mono">
                  {formatTimestamp(pair.detected_at)}
                </span>
              </div>
              <div>
                <span className="text-slate-500">run:</span>{' '}
                <span className="font-mono">
                  {pair.detection_run_id ?? '—'}
                </span>
              </div>
            </div>
          </section>

          <DuplicateActionPanel pair={pair} />
        </>
      )}
    </div>
  );
}
