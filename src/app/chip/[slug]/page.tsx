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

function formatCAD(n: number): string {
  return Math.round(n).toLocaleString('en-CA');
}

/* ──────────────────────────────────────────────────────────────────────── */

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { chip } = await resolveChipPage(slug);
  if (!chip) return { title: 'Chip not found · TrackAura' };

  const { stats } = chip;
  const lowSuffix = stats.lowestPrice
    ? ` — from CAD $${formatCAD(stats.lowestPrice)}`
    : '';

  const description = stats.lowestPrice
    ? `Live Canadian prices for ${chip.name} graphics cards. ${stats.boardCount} board${stats.boardCount === 1 ? '' : 's'} tracked across ${stats.retailerCount} retailer${stats.retailerCount === 1 ? '' : 's'}. From $${formatCAD(stats.lowestPrice)} CAD.`
    : `Canadian price tracking for ${chip.name} graphics cards. ${stats.boardCount} board${stats.boardCount === 1 ? '' : 's'} in catalog. No current in-stock listings.`;

  return {
    title: `${chip.name} price Canada${lowSuffix} · TrackAura`,
    description,
    alternates: { canonical: `${SITE}/chip/${chip.cleanSlug}` },
    openGraph: {
      title: `${chip.name} price Canada${lowSuffix}`,
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
