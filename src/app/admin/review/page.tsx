import Link from 'next/link';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { ActionButtons } from './action-buttons';
import { restartQueue } from './actions';

export const dynamic = 'force-dynamic';

const SKIP_COOKIE = 'trackaura_review_skipped_gpu';

type Board = {
  id: number;
  canonical_name: string;
  brand: string | null;
  image_primary_url: string | null;
};

type ChipCandidate = {
  id: number;
  canonical_name: string;
  brand: string | null;
  similarity: number;
};

async function getQueueState(searchQuery: string | null) {
  const cookieStore = await cookies();
  const skippedRaw = cookieStore.get(SKIP_COOKIE)?.value ?? '';
  const skippedIds = skippedRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));

  const supabase = createAdminClient();

  const { count: totalRemaining, error: totalErr } = await supabase
    .from('canonical_entities')
    .select('*', { count: 'exact', head: true })
    .eq('entity_type', 'gpus')
    .is('parent_entity_id', null);

  if (totalErr) throw new Error(`count total: ${totalErr.message}`);

  let boardQuery = supabase
    .from('canonical_entities')
    .select('id, canonical_name, brand, image_primary_url')
    .eq('entity_type', 'gpus')
    .is('parent_entity_id', null);

  if (skippedIds.length > 0) {
    boardQuery = boardQuery.not('id', 'in', `(${skippedIds.join(',')})`);
  }

  const { data: board, error: boardErr } = await boardQuery
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (boardErr) throw new Error(`fetch board: ${boardErr.message}`);

  let candidates: ChipCandidate[] = [];

  if (board) {
    const { data: rows, error: candErr } = await supabase.rpc(
      'find_chip_candidates',
      {
        board_name: board.canonical_name,
        limit_n: 10,
        search_query: searchQuery,
      },
    );

    if (candErr) throw new Error(`fetch candidates: ${candErr.message}`);
    candidates = (rows ?? []) as ChipCandidate[];
  }

  return {
    totalRemaining: totalRemaining ?? 0,
    skippedCount: skippedIds.length,
    board: board as Board | null,
    candidates,
  };
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const searchQuery = q?.trim() || null;

  const { totalRemaining, skippedCount, board, candidates } =
    await getQueueState(searchQuery);

  if (!board && skippedCount === 0) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-medium mb-2">Queue empty</h1>
        <p className="text-neutral-400">
          All GPU boards are parented. Nothing to review.
        </p>
      </div>
    );
  }

  if (!board && skippedCount > 0) {
    return (
      <div className="text-center py-16 space-y-4">
        <h1 className="text-2xl font-medium">Queue cleared</h1>
        <p className="text-neutral-400">
          {skippedCount} board{skippedCount === 1 ? '' : 's'} skipped this
          session.
        </p>
        <form action={restartQueue}>
          <button
            type="submit"
            className="px-4 py-2 text-sm bg-teal-600 hover:bg-teal-500 rounded font-medium"
          >
            Restart queue (show skipped)
          </button>
        </form>
      </div>
    );
  }

  const topSimilarity = candidates[0]?.similarity ?? 0;
  const queueLabel = `${totalRemaining - skippedCount} remaining${
    skippedCount > 0 ? ` · ${skippedCount} skipped this session` : ''
  }`;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-medium">Unparented GPU boards</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-neutral-500">{queueLabel}</span>
          {skippedCount > 0 ? (
            <form action={restartQueue}>
              <button
                type="submit"
                className="text-xs text-neutral-500 hover:text-neutral-300 underline"
              >
                Restart
              </button>
            </form>
          ) : null}
        </div>
      </div>

      <div className="border border-neutral-800 rounded-lg p-6 bg-neutral-900/50">
        <div className="text-xs text-neutral-500 mb-3">Board #{board!.id}</div>
        <div className="flex gap-4">
          {board!.image_primary_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={board!.image_primary_url}
              alt=""
              className="w-24 h-24 object-contain bg-neutral-800 rounded flex-shrink-0"
            />
          ) : (
            <div className="w-24 h-24 bg-neutral-800 rounded flex-shrink-0 flex items-center justify-center text-xs text-neutral-600">
              no image
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-medium text-neutral-100 break-words leading-snug">
              {board!.canonical_name}
            </h2>
            <div className="mt-3 text-xs text-neutral-500">
              Brand field:{' '}
              <span className="text-neutral-400 font-mono">
                {board!.brand ?? '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-sm font-medium text-neutral-400">
            Chip candidates
          </h3>
          {candidates.length > 0 && !searchQuery ? (
            <span className="text-xs text-neutral-600">
              top similarity: {topSimilarity.toFixed(2)}
              {topSimilarity < 0.3 ? ' · likely no good match' : ''}
            </span>
          ) : null}
        </div>

        <form method="GET" action="/admin/review" className="flex gap-2 mb-4">
          <input
            name="q"
            defaultValue={searchQuery ?? ''}
            placeholder="Search chips (e.g. GT 710, RTX 4070, Radeon HD 7750)"
            autoComplete="off"
            className="flex-1 px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-sm focus:outline-none focus:border-teal-500"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded text-sm transition"
          >
            Search
          </button>
          {searchQuery ? (
            <Link
              href="/admin/review"
              className="px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-100 border border-neutral-800 hover:border-neutral-700 rounded transition"
            >
              Clear
            </Link>
          ) : null}
        </form>

        {searchQuery ? (
          <p className="text-xs text-neutral-500 mb-3">
            Showing chips matching{' '}
            <span className="text-neutral-300 font-mono">
              &ldquo;{searchQuery}&rdquo;
            </span>
            {candidates.length === 0
              ? ' — no results. The chip may not be in the catalog yet; skip the board if so.'
              : null}
          </p>
        ) : null}

        {candidates.length === 0 && !searchQuery ? (
          <p className="text-sm text-neutral-500 mb-4">
            No chip candidates found.
          </p>
        ) : null}

        <ActionButtons
          boardId={board!.id}
          boardName={board!.canonical_name}
          candidates={candidates}
          isSearchMode={!!searchQuery}
        />
      </div>
    </div>
  );
}
