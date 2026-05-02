// src/components/chip/ChipHero.tsx
//
// Identity-first hero for the chip page. Text-only — image, MSRP, and
// description are NULL across every gpu_chip row until dbgpu metadata
// backfill lands (§10 tail). When backfill happens, this component grows
// an optional image and MSRP slot; layout is reserved for it.

import type { ChipEntity } from '@/lib/chip/slug-resolver';
import type { ChipStats } from '@/lib/chip/get-chip-view-model';

type Props = {
  chip: ChipEntity;
  stats: ChipStats;
};

export function ChipHero({ chip, stats }: Props) {
  const name = chip.display_name ?? chip.canonical_name;
  const subtitleParts = [
    chip.brand,
    formatReleaseDate(chip.release_date),
  ].filter(Boolean);

  return (
    <header className="border-b border-zinc-800 pb-8 mb-8">
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
        {name}
      </h1>
      {subtitleParts.length > 0 && (
        <p className="mt-2 text-sm text-zinc-400">
          {subtitleParts.join(' · ')}
        </p>
      )}

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <FactTile
          label="Lowest listed"
          value={
            stats.lowest_price !== null
              ? formatPrice(stats.lowest_price)
              : '—'
          }
        />
        <FactTile
          label="Boards tracked"
          value={stats.board_count.toString()}
        />
        <FactTile
          label="Active listings"
          value={stats.active_listing_count.toString()}
        />
        <FactTile
          label="Retailers"
          value={stats.retailer_count.toString()}
        />
      </div>
    </header>
  );
}

function FactTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:p-4">
      <div className="text-[10px] sm:text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-lg sm:text-xl font-semibold text-white tabular-nums">
        {value}
      </div>
    </div>
  );
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(price);
}

function formatReleaseDate(date: string | null): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return `Released ${d.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
  })}`;
}
