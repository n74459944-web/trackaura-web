// src/app/chip/[slug]/page.tsx
//
// /chip/[slug] route. Resolves a clean public slug (e.g. "rtx-5090") to the
// underlying chip entity, fetches the view model, and renders.
//
// Canonicalization: if a user hits the route with the DB-shaped slug
// ("nvidia-geforce-rtx-5090"), we 308 to the clean form. The clean slug is
// the only canonical URL we emit anywhere (metadata, JSON-LD, internal links).

import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import {
  resolveChipBySlug,
  publicSlugFromDbSlug,
} from '@/lib/chip/slug-resolver';
import { getChipViewModel } from '@/lib/chip/get-chip-view-model';
import { ChipHero } from '@/components/chip/ChipHero';
import { BoardTable } from '@/components/chip/BoardTable';

export const revalidate = 300; // 5 min ISR (matches existing product-page pattern)

type PageProps = {
  params: Promise<{ slug: string }>;
};

/* ─────────────────────────────────────────────────────────────────────────
   Metadata (SEO)

   Targets identified from GSC top queries (2026-05-02 baseline):
     - `rtx 5090 canada`, `intel b70 canada`, `intel arc pro` (specific chip)
     - `nvidia rtx 5090`, `amd radeon rx 9070 xt` (brand + chip)
     - `compare gpu prices canada`, `cheapest rtx 4070` (comparison intent)

   Decisions:
     - Title: `{name} Price in Canada · {brand} GPU · TrackAura`
       Brand is included for brand+chip queries; chip names are short enough
       to leave room for the suffix
     - Description leads with `Compare X across {N} retailers` when stats
       are present, falls back to comparison-without-count language
     - JSON-LD provides the precise current price; no need to put it in
       the description (which would go stale in SERP)

   Performance: generateMetadata calls resolveChipBySlug AND getChipViewModel,
   same as the page render. Both functions need React.cache() wrapping at
   their definition sites so the calls dedupe within a single request.
   See lib/chip/slug-resolver.ts and lib/chip/get-chip-view-model.ts.
   ───────────────────────────────────────────────────────────────────────── */

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { chip } = await resolveChipBySlug(slug);
  if (!chip) return { title: 'Chip not found · TrackAura' };

  const name = chip.display_name ?? chip.canonical_name;
  const cleanSlug = publicSlugFromDbSlug(chip.slug);

  // Brand suffix for title — only if brand is set and short enough not to
  // blow the title past Google's display limit. NVIDIA / AMD / Intel are all
  // fine. Skip for outlier brands or when null.
  const brandSuffix =
    chip.brand && chip.brand.length <= 8 ? ` · ${chip.brand} GPU` : '';
  const title = `${name} Price in Canada${brandSuffix} · TrackAura`;

  // Pull stats for description. View model is React.cache'd so this dedupes
  // with the call in the page render.
  const vm = await getChipViewModel(chip).catch(() => null);
  const retailerCount = vm?.stats.retailer_count ?? 0;
  const listingCount = vm?.stats.active_listing_count ?? 0;

  let description: string;
  if (retailerCount >= 2 && listingCount > 0) {
    description = `Compare ${name} prices across ${retailerCount} Canadian retailers — ${listingCount} active listings. Live price history, stock status, and price drop alerts. Updated every few hours.`;
  } else if (retailerCount === 1) {
    description = `Live ${name} price tracking in Canada. Price history, stock status, and price drop alerts. Updated every few hours.`;
  } else {
    description = `Canadian price tracking for ${name}. Compare prices, view price history, and get alerts when boards return to stock at major Canadian retailers.`;
  }

  return {
    title,
    description,
    alternates: {
      canonical: `https://www.trackaura.com/chip/${cleanSlug}`,
    },
    openGraph: {
      title: `${name} Price in Canada${brandSuffix}`,
      description,
      url: `https://www.trackaura.com/chip/${cleanSlug}`,
      type: 'website',
    },
  };
}

export default async function ChipPage({ params }: PageProps) {
  const { slug } = await params;
  const { chip } = await resolveChipBySlug(slug);
  if (!chip) notFound();

  // Canonicalization: any DB-shaped slug 308s to the clean form.
  const cleanSlug = publicSlugFromDbSlug(chip.slug);
  if (slug !== cleanSlug) redirect(`/chip/${cleanSlug}`);

  const vm = await getChipViewModel(chip);

  // JSON-LD: Product schema with AggregateOffer when we have prices.
  // Skip offers entirely when lowest_price is null — better to omit than to
  // emit a misleading $0 or partial offer block.
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: chip.display_name ?? chip.canonical_name,
    url: `https://www.trackaura.com/chip/${cleanSlug}`,
  };
  if (chip.brand) {
    jsonLd.brand = { '@type': 'Brand', name: chip.brand };
  }
  if (vm.stats.lowest_price !== null) {
    jsonLd.offers = {
      '@type': 'AggregateOffer',
      priceCurrency: 'CAD',
      lowPrice: vm.stats.lowest_price,
      offerCount: vm.stats.active_listing_count,
      availability: 'https://schema.org/InStock',
    };
  }
  if (vm.stats.last_observation_at) {
    jsonLd.dateModified = vm.stats.last_observation_at;
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <ChipHero chip={chip} stats={vm.stats} />
        <BoardTable boards={vm.boards} />
        <ProvenanceFooter
          observedAt={vm.stats.last_observation_at}
          retailerCount={vm.stats.retailer_count}
          activeListingCount={vm.stats.active_listing_count}
        />
      </main>
    </>
  );
}

function ProvenanceFooter({
  observedAt,
  retailerCount,
  activeListingCount,
}: {
  observedAt: string | null;
  retailerCount: number;
  activeListingCount: number;
}) {
  const observed = observedAt
    ? `Last update ${new Date(observedAt).toLocaleString('en-CA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })}`
    : 'No recent observations';

  return (
    <footer className="mt-12 pt-6 border-t border-zinc-800 text-xs text-zinc-500">
      <p>
        Tracking {activeListingCount} active{' '}
        {activeListingCount === 1 ? 'listing' : 'listings'} across{' '}
        {retailerCount} {retailerCount === 1 ? 'retailer' : 'retailers'}.{' '}
        {observed}.
      </p>
      <p className="mt-2">
        TrackAura is a Canadian price registry. We don&apos;t hold inventory or
        process transactions. Retailer links may include affiliate tracking;
        ranking is always factual, never paid.
      </p>
    </footer>
  );
}
