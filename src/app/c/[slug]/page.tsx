import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import CategoryPage from '@/components/category/CategoryPage';
import {
  getCategoryViewModel,
  type CategoryViewModel,
} from '@/lib/queries/category';

type Params = { slug: string };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://trackaura.com';

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cat = await getCategoryViewModel(slug);
  if (!cat) return { title: 'Category not found · TrackAura' };

  return {
    title: `${cat.name} — Live Prices in Canada · TrackAura`,
    description: `Compare live prices for ${cat.stats.totalProducts.toLocaleString()} ${cat.name.toLowerCase()} across Canadian retailers. Price history, deal alerts, and all-time-low tracking.`,
    alternates: { canonical: `${SITE}/c/${slug}` },
    openGraph: {
      title: `${cat.name} — Live Prices in Canada`,
      description: `${cat.stats.totalProducts.toLocaleString()} products · ${cat.stats.atLowest} at all-time low`,
      type: 'website',
      url: `${SITE}/c/${slug}`,
    },
  };
}

function buildCollectionJsonLd(cat: CategoryViewModel) {
  // Only top 20 products go into the ItemList — enough for Google to
  // crawl internal links without bloating the HTML payload.
  const topProducts = cat.products
    .filter((p) => p.inStock && p.bestPrice != null)
    .slice(0, 20);

  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${cat.name} Prices in Canada`,
    url: `${SITE}/c/${cat.slug}`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: cat.stats.totalProducts,
      itemListElement: topProducts.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE}/p/${p.slug}`,
        name: p.name,
      })),
    },
  };
}

function buildBreadcrumbJsonLd(cat: CategoryViewModel) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${SITE}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Products',
        item: `${SITE}/products`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: cat.name,
        item: `${SITE}/c/${cat.slug}`,
      },
    ],
  };
}

export default async function Page({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const cat = await getCategoryViewModel(slug);
  if (!cat) notFound();

  const collectionLd = buildCollectionJsonLd(cat);
  const breadcrumbLd = buildBreadcrumbJsonLd(cat);

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <CategoryPage category={cat} />
    </>
  );
}

// Revalidate every 10 minutes. Categories change less often than individual
// product prices, and a heavier query benefits from longer caching.
export const revalidate = 600;
