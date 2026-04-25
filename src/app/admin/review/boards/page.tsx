import Link from 'next/link';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/auth';
import { BoardActionPanel } from './board-action-panel';
import { restartBoardQueue } from './actions';

/**
 * /admin/review/boards
 *
 * Per ARCHITECTURE.md §10 Week 4 and §12. Consumes the
 * `pending_board_proposals` queue produced by `sync_resolver_to_new_schema.py`.
 * Sibling of /admin/review (chip-level review). Same shared-secret auth,
 * same skip-via-cookie pattern, but three decision paths:
 *
 *   1. Link the listing to an existing board under the resolved chip
 *   2. Create a new board canonical and link the listing to it
 *   3. Reject (not a GPU / scraper error / etc.)
 *
 * No auto-create on this UI — every new board canonical is human-decided
 * per §5 principle #3 (clarified 2026-04-23).
 */

export const dynamic = 'force-dynamic';

const SKIP_COOKIE = 'trackaura_admin_skipped_boards';

interface CandidateBoard {
  entity_id: number;
  canonical_name: string;
  brand: string | null;
  score: number;
  shared_sku_token?: string | null;
  brand_match?: boolean;
  jaccard?: number;
  memory_gb?: number | null;
  product_line?: string | null;
  singleton_bonus?: boolean;
  [key: string]: unknown;
}

interface ProposedNewBoard {
  canonical_name?: string;
  brand?: string;
  memory_gb?: number;
  product_line?: string;
  [key: string]: unknown;
}

interface PendingProposal {
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
  resolver_tier: string;
  match_confidence: number | null;
  resolver_reasoning: string | null;
  candidate_boards: CandidateBoard[] | null;
  proposed_new_board: ProposedNewBoard | null;
  status: string;
  priority: number | null;
  created_at: string;
}

interface ChipParent {
  id: number;
  canonical_name: string;
  brand: string | null;
}

interface QueueStats {
  total: number;
  by_tier: Record<string, number>;
  by_retailer: Record<string, number>;
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
    .from('pending_board_proposals')
    .select('resolver_tier, retailer')
    .eq('status', 'pending');

  if (error) {
    throw new Error(`fetchQueueStats: ${error.message}`);
  }

  const stats: QueueStats = {
    total: data?.length ?? 0,
    by_tier: {},
    by_retailer: {},
  };
  for (const row of data ?? []) {
    const tier = (row.resolver_tier as string) ?? 'unknown';
    const retailer = (row.retailer as string) ?? 'unknown';
    stats.by_tier[tier] = (stats.by_tier[tier] ?? 0) + 1;
    stats.by_retailer[retailer] = (stats.by_retailer[retailer] ?? 0) + 1;
  }
  return stats;
}

async function fetchNextProposal(
  skippedIds: number[],
): Promise<PendingProposal | null> {
  const supabase = createAdminClient();
  let query = supabase
    .from('pending_board_proposals')
    .select('*')
    .eq('status', 'pending')
    // Highest-priority first, then oldest first
    .order('priority', { ascending: false, nullsFirst: false })
    .order('id', { ascending: true })
    .limit(1);

  if (skippedIds.length > 0) {
    query = query.not('id', 'in', `(${skippedIds.join(',')})`);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(`fetchNextProposal: ${error.message}`);
  }
  return (data as PendingProposal | null) ?? null;
}

async function fetchChip(chipId: number): Promise<ChipParent | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('canonical_entities')
    .select('id, canonical_name, brand')
    .eq('id', chipId)
    .maybeSingle();

  if (error) {
    throw new Error(`fetchChip: ${error.message}`);
  }
  return (data as ChipParent | null) ?? null;
}

function formatTier(tier: string): string {
  return tier.replace(/^board_match_/, '').replace(/_/g, ' ');
}

function formatPrice(cad: number | null): string {
  if (cad === null || cad === undefined) return '—';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(cad);
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

export default async function ReviewBoardsPage() {
  await requireAdmin();

  const skippedIds = await fetchSkippedIds();
  const [stats, proposal] = await Promise.all([
    fetchQueueStats(),
    fetchNextProposal(skippedIds),
  ]);

  const chip = proposal ? await fetchChip(proposal.proposed_chip_id) : null;

  const sortedCandidates: CandidateBoard[] = proposal?.candidate_boards
    ? [...proposal.candidate_boards].sort(
        (a, b) => (b.score ?? 0) - (a.score ?? 0),
      )
    : [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 text-slate-100">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-teal-400">
            Board proposal review
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            <Link href="/admin/review" className="hover:text-teal-400">
              ← chip review
            </Link>
          </p>
        </div>
        <div className="text-right text-sm">
          <div className="font-mono text-teal-400">{stats.total} pending</div>
          {skippedIds.length > 0 && (
            <form action={restartBoardQueue}>
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
        <div className="grid grid-cols-2 gap-4 text-slate-300">
          <div>
            <div className="mb-1 text-slate-500">By tier</div>
            {Object.entries(stats.by_tier)
              .sort(([, a], [, b]) => b - a)
              .map(([tier, n]) => (
                <div key={tier} className="font-mono">
                  {formatTier(tier)}: {n}
                </div>
              ))}
          </div>
          <div>
            <div className="mb-1 text-slate-500">By retailer</div>
            {Object.entries(stats.by_retailer)
              .sort(([, a], [, b]) => b - a)
              .map(([r, n]) => (
                <div key={r} className="font-mono">
                  {r}: {n}
                </div>
              ))}
          </div>
        </div>
      </section>

      {!proposal ? (
        <div className="rounded-md border border-slate-800 bg-slate-900/50 p-8 text-center">
          <div className="text-lg text-teal-400">Queue empty</div>
          <p className="mt-2 text-sm text-slate-400">
            All pending board proposals have been reviewed or skipped.
            {skippedIds.length > 0 &&
              ' Clear the skip list above to revisit skipped proposals.'}
          </p>
        </div>
      ) : (
        <>
          <section className="mb-6 rounded-md border border-slate-800 bg-slate-900/50 p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-sm text-slate-500">
                  Proposal #{proposal.id}
                </span>
                {proposal.priority !== null && proposal.priority > 0 && (
                  <span className="font-mono text-xs text-amber-300">
                    priority={proposal.priority}
                  </span>
                )}
              </div>
              <div className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs uppercase tracking-wider text-amber-400">
                {formatTier(proposal.resolver_tier)}
              </div>
            </div>

            <div className="mb-4">
              <div className="mb-1 text-xs uppercase tracking-wider text-slate-500">
                Source listing
              </div>
              <div className="text-base text-slate-100">
                {proposal.raw_title}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-400">
                <div>
                  <span className="text-slate-500">retailer:</span>{' '}
                  <span className="font-mono">{proposal.retailer}</span>
                </div>
                <div>
                  <span className="text-slate-500">brand:</span>{' '}
                  <span className="font-mono">{proposal.brand ?? '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500">price:</span>{' '}
                  <span className="font-mono">
                    {formatPrice(proposal.price_cad)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">scraped:</span>{' '}
                  <span className="font-mono">
                    {formatTimestamp(proposal.scraped_at)}
                  </span>
                </div>
                {proposal.retailer_sku && (
                  <div className="col-span-2">
                    <span className="text-slate-500">sku:</span>{' '}
                    <span className="font-mono">{proposal.retailer_sku}</span>
                  </div>
                )}
              </div>
              <a
                href={proposal.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs text-teal-400 hover:underline"
              >
                open at {proposal.retailer} ↗
              </a>
            </div>

            <div className="border-t border-slate-800 pt-3">
              <div className="mb-1 text-xs uppercase tracking-wider text-slate-500">
                Resolved chip parent
                {proposal.match_confidence !== null && (
                  <span className="ml-2 text-slate-400">
                    (confidence{' '}
                    <span className="font-mono">
                      {proposal.match_confidence.toFixed(2)}
                    </span>
                    )
                  </span>
                )}
              </div>
              {chip ? (
                <div className="text-sm">
                  <span className="text-slate-100">{chip.canonical_name}</span>{' '}
                  <span className="font-mono text-xs text-slate-500">
                    (id {chip.id})
                  </span>
                </div>
              ) : (
                <div className="text-sm text-rose-400">
                  Chip {proposal.proposed_chip_id} not found in
                  canonical_entities. Investigate before approving.
                </div>
              )}
              {proposal.resolver_reasoning && (
                <div className="mt-2 rounded border border-slate-800 bg-slate-950/60 p-2 text-xs italic text-slate-400">
                  {proposal.resolver_reasoning}
                </div>
              )}
            </div>
          </section>

          <BoardActionPanel
            proposalId={proposal.id}
            chipId={proposal.proposed_chip_id}
            chipName={chip?.canonical_name ?? null}
            sourceTitle={proposal.raw_title}
            sourceBrand={proposal.brand}
            candidates={sortedCandidates}
            proposedNewBoard={proposal.proposed_new_board}
          />
        </>
      )}
    </div>
  );
}
