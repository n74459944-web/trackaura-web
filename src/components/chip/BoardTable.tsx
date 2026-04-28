// src/components/chip/BoardTable.tsx
//
// Renders the boards × retailers comparison for a chip. Each board is a card
// containing its retailer listings, sorted by current price ascending. Boards
// without active listings are collapsed into a footer disclosure.
//
// Long board names: line-clamped to 2 lines. The dbgpu canonical_name is
// frequently a full marketing string (e.g. "MSI GeForce RTX 5090 32G VANGUARD
// OC Graphics Card - 32GB 512-bit GDDR7..."). display_name cleanup is a §12
// open question; line-clamp is the workaround.

import type { Board, BoardListing } from '@/lib/queries/chip';

type Props = {
  boards: Board[];
};

export function BoardTable({ boards }: Props) {
  if (boards.length === 0) {
    return (
      <section>
        <h2 className="text-xl font-semibold text-white mb-4">Boards</h2>
        <p className="text-zinc-500 text-sm">
          No boards tracked for this chip yet.
        </p>
      </section>
    );
  }

  const withListings = boards.filter((b) => b.listings.length > 0);
  const withoutListings = boards.filter((b) => b.listings.length === 0);

  return (
    <section>
      <h2 className="text-xl font-semibold text-white mb-4">
        Boards
        <span className="ml-2 text-sm font-normal text-zinc-500">
          {boards.length} tracked
        </span>
      </h2>

      {withListings.length === 0 ? (
        <p className="text-zinc-500 text-sm">
          No active retailer listings right now. {withoutListings.length}{' '}
          {withoutListings.length === 1 ? 'board' : 'boards'} tracked but not
          currently listed.
        </p>
      ) : (
        <div className="space-y-3">
          {withListings.map((board) => (
            <BoardCard key={board.id} board={board} />
          ))}
        </div>
      )}

      {withoutListings.length > 0 && withListings.length > 0 && (
        <details className="mt-8 group">
          <summary className="cursor-pointer text-sm text-zinc-500 hover:text-zinc-300 select-none">
            {withoutListings.length} more{' '}
            {withoutListings.length === 1 ? 'board' : 'boards'} tracked but not
            currently listed
          </summary>
          <ul className="mt-3 space-y-1 text-sm text-zinc-500 pl-4 border-l border-zinc-800">
            {withoutListings.map((b) => (
              <li key={b.id}>{b.display_name ?? b.canonical_name}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function BoardCard({ board }: { board: Board }) {
  const name = board.display_name ?? board.canonical_name;
  return (
    <article className="rounded-lg border border-zinc-800 bg-zinc-900/30 overflow-hidden">
      <header className="px-4 py-3 sm:px-5 sm:py-4 border-b border-zinc-800 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm sm:text-base font-medium text-white line-clamp-2">
            {name}
          </h3>
          {board.brand && (
            <div className="mt-1 text-xs text-zinc-500">{board.brand}</div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wide">
            From
          </div>
          <div className="text-base sm:text-lg font-semibold text-white tabular-nums">
            {board.lowest_price !== null
              ? formatPrice(board.lowest_price)
              : '—'}
          </div>
        </div>
      </header>

      <ul className="divide-y divide-zinc-800">
        {board.listings.map((listing) => (
          <ListingRow key={listing.listing_id} listing={listing} />
        ))}
      </ul>
    </article>
  );
}

function ListingRow({ listing }: { listing: BoardListing }) {
  const freshness = freshnessLabel(listing.observed_at);
  const isStale = isStaleObservation(listing.observed_at);

  return (
    <li>
      <a
        href={listing.url}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="grid grid-cols-[1fr_auto_auto] items-center gap-3 sm:gap-4 px-4 py-3 sm:px-5 hover:bg-zinc-900/50 transition-colors"
      >
        <div className="min-w-0">
          <div className="text-sm font-medium text-white">
            {prettyRetailer(listing.retailer)}
          </div>
          <div
            className={`text-xs ${isStale ? 'text-amber-500/80' : 'text-zinc-500'}`}
          >
            {freshness}
          </div>
        </div>
        <div className="text-sm sm:text-base font-semibold text-white tabular-nums">
          {listing.current_price !== null
            ? formatPrice(listing.current_price)
            : '—'}
        </div>
        <span className="text-xs text-emerald-400 group-hover:text-emerald-300">
          View →
        </span>
      </a>
    </li>
  );
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 2,
  }).format(price);
}

function prettyRetailer(retailer: string): string {
  const map: Record<string, string> = {
    canada_computers: 'Canada Computers',
    'canada computers': 'Canada Computers',
    cc: 'Canada Computers',
    newegg: 'Newegg',
    newegg_canada: 'Newegg Canada',
    'newegg canada': 'Newegg Canada',
    vuugo: 'Vuugo',
    visions: 'Visions Electronics',
    visions_electronics: 'Visions Electronics',
    'visions electronics': 'Visions Electronics',
    best_buy_canada: 'Best Buy Canada',
    'best buy canada': 'Best Buy Canada',
    memory_express: 'Memory Express',
    'memory express': 'Memory Express',
  };
  return map[retailer.toLowerCase()] ?? retailer;
}

function freshnessLabel(observed_at: string | null): string {
  if (!observed_at) return 'No recent price';
  const date = new Date(observed_at);
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

function isStaleObservation(observed_at: string | null): boolean {
  if (!observed_at) return true;
  const date = new Date(observed_at);
  if (isNaN(date.getTime())) return true;
  const hoursAgo = (Date.now() - date.getTime()) / (1000 * 60 * 60);
  return hoursAgo >= 48; // 2+ days = visually flagged
}
