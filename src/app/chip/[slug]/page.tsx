import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';
import type { Metadata } from 'next';
import ChipPage from '@/components/chip/ChipPage';
import { resolveChipSlug, type ChipSlugResolution } from '@/lib/chip-slug';
import { getChipViewModel, type ChipViewModel } from '@/lib/queries/chip';

type Params = { slug: string };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://trackaura.com';

/* ────────────────────────────────────────────────────────────────────────
   Single dedup'd resolution function. React's `cache()` ensures
   generateMetadata and the Page component share one fetch per request,
   so we don't hit Supabase twice for the same slug.

   entityId comes back as number-or-string depending on Postgres column
   type (bigint here); coerce to string at the boundary for type
   consistency through getChipViewModel. PostgREST round-trips fine.
   ──────────────────────────────────────────────────────────────────────── */
const resolveChipPage = cache(
  async (
    slug: string,
  ): Promise<{ resolution: ChipSlugResolution; chip: ChipViewModel | null }> => {
    const resolution = await resolveChipSlug(slug);
    if (resolution.entityId == null) return { resolution, chip: null };
    const chip = await getChipViewModel(String(resolution.entityId));
    return { resolution, chip };
  },
);

/* ────────────────────────────────────────────────────────────────────────
   Metadata (SEO)

   Targets identified from GSC top queries (2026-05-02 baseline, 0.6% CTR
   against 38.8K impressions over 3 months):
     - `rtx 5090 canada`, `intel b70 canada`, `intel arc pro` (specific chip)
     - `nvidia rtx 5090`, `amd radeon rx 9070 xt` (brand + chip)
     - `compare gpu prices canada`, `cheapest rtx 4070` (comparison intent)

   Decisions vs prior templates:
     - Title: `{name} Price in Canada · {brand} GPU · TrackAura`. Brand
       is included for brand+chip queries; chip names are short enough to
       leave room for the suffix. Price-from-suffix dropped — Google's
       SERP snapshot lags actual price by days/weeks; stale numbers in
       the SERP are a credibility hit.
     - "Price" capitalized — reads as a noun, not a query fragment.
     - Title is set as `{ absolute }` to bypass the root layout's title
       template (which would otherwise append " | TrackAura" giving us
       a double brand suffix).
     - Description leads with `Compare X across N retailers — M active
       listings` (matches comparison-intent queries directly), then adds
       `price history` + `price drop alerts` (matches `canada computers
       price history` and intent-to-track queries). Both are facts the
       page actually delivers.
   ──────────────────────────────────────────────────────────────────────── */

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { chip } = await resolveChipPage(slug);
  if (!chip) return { title: { absolute: 'Chip not found · TrackAura' } };

  const { stats } = chip;

  // Brand suffix for title — only if brand is set and short. NVIDIA / AMD /
  // Intel are all fine. Skip for outliers or null brands.
  const brandSuffix =
    chip.brand && chip.brand.length <= 8 ? ` · ${chip.brand} GPU` : '';
  const titleStr = `${chip.name} Price in Canada${brandSuffix} · TrackAura`;

  let description: string;
  if (stats.retailerCount >= 2 && stats.activeListingCount > 0) {
    description = `Compare ${chip.name} prices across ${stats.retailerCount} Canadian retailers — ${stats.activeListingCount} active listings. Live price history, stock status, and price drop alerts. Updated every few hours.`;
  } else if (stats.retailerCount === 1) {
    description = `Live ${chip.name} price tracking in Canada. Price history, stock status, and price drop alerts. Updated every few hours.`;
  } else {
    description = `Canadian price tracking for ${chip.name}. Compare prices, view price history, and get alerts when boards return to stock at major Canadian retailers.`;
  }

  return {
    title: { absolute: titleStr },
    description,
    alternates: { canonical: `${SITE}/chip/${chip.cleanSlug}` },
    openGraph: {
      title: `${chip.name} Price in Canada${brandSuffix}`,
      description,
      type: 'website',
      url: `${SITE}/chip/${chip.cleanSlug}`,
    },
  };
}

/* ────────────────────────────────────────────────────────────────────────
   JSON-LD

   The chip itself isn't really a Product — Products are the boards. But
   Schema.org's ProductGroup type renders poorly in Google's rich results,
   so we emit a Product representing the chip with an AggregateOffer
   summarizing the price range across all in-stock boards. This is the
   pragmatic SEO play for "RTX 5090 price Canada"-style queries.

   Boards each get their own Product schema on /p/[slug] pages.
   ──────────────────────────────────────────────────────────────────────── */

function buildProductLd(chip: ChipViewModel) {
  const url = `${SITE}/chip/${chip.cleanSlug}`;
  const inStock = chip.boards.flatMap((b) =>
    b.listings.filter((l) => l.currentPrice != null),
  );

  const offers =
    inStock.length > 0
      ? {
          '@type': 'AggregateOffer',
          priceCurrency: 'CAD',
          lowPrice: Math.min(...inStock.map((l) => l.currentPrice as number)),
          highPrice: Math.max(...inStock.map((l) => l.currentPrice as number)),
          offerCount: inStock.length,
          availability: 'https://schema.org/InStock',
        }
      : {
          '@type': 'Offer',
          priceCurrency: 'CAD',
          availability: 'https://schema.org/OutOfStock',
          url,
        };

  return {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: chip.name,
    brand: chip.brand ? { '@type': 'Brand', name: chip.brand } : undefined,
    category: 'Graphics Cards',
    url,
    offers,
  };
}

function buildBreadcrumbLd(chip: ChipViewModel) {
  const items = [
    { label: 'Home', href: '/' },
    { label: 'Graphics Cards', href: '/c/gpus' },
    { label: chip.name, href: `/chip/${chip.cleanSlug}` },
  ].map((c, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: c.label,
    item: `${SITE}${c.href}`,
  }));

  return {
    '@context': 'https://schema.org/',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };
}

/* ──────────────────────────────────────────────────────────────────────── */

export default async function Page({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const { resolution, chip } = await resolveChipPage(slug);

  if (resolution.entityId == null) notFound();

  // Brand-prefix URL (e.g. /chip/nvidia-geforce-rtx-5090) → 308 to clean.
  if (resolution.needsRedirect) {
    permanentRedirect(`/chip/${resolution.cleanSlug}`);
  }

  if (!chip) notFound();

  const productLd = buildProductLd(chip);
  const breadcrumbLd = buildBreadcrumbLd(chip);

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <ChipPage chip={chip} />
    </>
  );
}

// Match /p/[slug] cadence: scraper runs are slower than 5min so don't hit
// the DB on every pageview.
export const revalidate = 300;
