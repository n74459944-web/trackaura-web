// src/components/chip/BoardTable.tsx
//
// Renders the boards × retailers comparison for a chip. Each board is a card
// containing its retailer listings, sorted by current price ascending. Boards
// without active listings are collapsed into a footer disclosure.
//
// The parent ChipPage wraps this in <section><h2>Boards</h2>...</section>,
// so this component does not render its own outer heading. Only ever called
// when chip.boards.length > 0; the empty-catalog case is handled upstream.

import type { ChipBoard, ChipListing } from '@/lib/queries/chip';

type Props = {
  boards: ChipBoard[];
  chipName: string;
};

export function BoardTable({ boards, chipName }: Props) {
  const withListings = boards.filter((b) => b.listings.length > 0);
  const withoutListings = boards.filter((b) => b.listings.length === 0);

  if (withListings.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No active retailer listings for {chipName} right now.{' '}
        {withoutListings.length}{' '}
        {withoutListings.length === 1 ? 'board' : 'boards'} tracked but not
        currently listed.
      </p>
    );
  }

  return (
    <div>
      <div className="space-y-3">
        {withListings.map((board) => (
          <BoardCard key={board.id} board={board} />
        ))}
      </div>

      {withoutListings.length > 0 && (
        <details className="mt-8 group">
          <summary className="cursor-pointer text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 select-none">
            {withoutListings.length} more{' '}
            {withoutListings.length === 1 ? 'board' : 'boards'} tracked but not
            currently listed
          </summary>
          <ul className="mt-3 space-y-1 text-sm text-zinc-500 pl-4 border-l border-zinc-200 dark:border-zinc-800">
            {withoutListings.map((b) => (
              <li key={b.id}>{b.name}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function BoardCard({ board }: { board: ChipBoard }) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/30 overflow-hidden">
      <header className="px-4 py-3 sm:px-5 sm:py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm sm:text-base font-medium text-zinc-900 dark:text-white line-clamp-2">
            {board.name}
          </h3>
          {board.brand && (
            <div className="mt-1 text-xs text-zinc-500">{board.brand}</div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wide">
            From
          </div>
          <div className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-white tabular-nums">
            {board.lowestPrice !== null
              ? formatPrice(board.lowestPrice, board.lowestPriceCurrency)
              : '—'}
          </div>
        </div>
      </header>

      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {board.listings.map((listing) => (
          <ListingRow key={listing.id} listing={listing} />
        ))}
      </ul>
    </article>
  );
}

function ListingRow({ listing }: { listing: ChipListing }) {
  const freshness = freshnessLabel(listing.lastObservedAt);
  const isStale = isStaleObservation(listing.lastObservedAt);

  return (
    <li>
      <a
        href={listing.url}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="grid grid-cols-[1fr_auto_auto] items-center gap-3 sm:gap-4 px-4 py-3 sm:px-5 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
      >
        <div className="min-w-0">
          <div className="text-sm font-medium text-zinc-900 dark:text-white">
            {listing.retailerName}
          </div>
          <div
            className={`text-xs ${
              isStale ? 'text-amber-600 dark:text-amber-500/80' : 'text-zinc-500'
            }`}
          >
            {freshness}
          </div>
        </div>
        <div className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white tabular-nums">
          {listing.currentPrice !== null
            ? formatPrice(listing.currentPrice, listing.currency)
            : '—'}
        </div>
        <span className="text-xs text-emerald-700 dark:text-emerald-400">
          View →
        </span>
      </a>
    </li>
  );
}

function formatPrice(price: number, currency: string | null): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currency ?? 'CAD',
    maximumFractionDigits: 2,
  }).format(price);
}

function freshnessLabel(observedAt: string | null): string {
  if (!observedAt) return 'No recent price';
  const date = new Date(observedAt);
  if (isNaN(date.getTime())) return 'No recent price';

  const hoursAgo = (Date.now() - date.getTime()) / (1000 * 60 * 60);
  if (hoursAgo < 1) return 'Updated just now';
  if (hoursAgo < 24) return `Updated ${Math.floor(hoursAgo)}h ago`;
  if (hoursAgo < 48) return 'Updated yesterday';

  const daysAgo = Math.floor(hoursAgo / 24);
  if (daysAgo < 14) return `Updated ${daysAgo}d ago`;

  return `Updated ${date.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })}`;
}

function isStaleObservation(observedAt: string | null): boolean {
  if (!observedAt) return true;
  const date = new Date(observedAt);
  if (isNaN(date.getTime())) return true;
  const hoursAgo = (Date.now() - date.getTime()) / (1000 * 60 * 60);
  return hoursAgo >= 48; // 2+ days = visually flagged
}
