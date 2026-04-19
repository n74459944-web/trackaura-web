import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ProductPage from '@/components/product/ProductPage';
import {
  getProductViewModel,
  type ProductViewModel,
} from '@/lib/queries/product';

type Params = { slug: string };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://trackaura.com';

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductViewModel(slug);
  if (!product) return { title: 'Product not found · TrackAura' };

  const priceLabel = product.stats.current
    ? ` — $${Math.round(product.stats.current).toLocaleString('en-CA')} CAD`
    : '';

  return {
    title: `${product.title}${priceLabel} · TrackAura`,
    description:
      product.blurb ??
      `Live Canadian price tracking for the ${product.title}. Compare prices across Canadian retailers and see price history.`,
    alternates: { canonical: `${SITE}/p/${product.slug}` },
    openGraph: product.imageUrl
      ? {
          title: `${product.title}${priceLabel}`,
          images: [product.imageUrl],
          type: 'website',
          url: `${SITE}/p/${product.slug}`,
        }
      : undefined,
  };
}

/* ──────────────────────────────────────────────────────────────
   JSON-LD builders
   ──────────────────────────────────────────────────────────────
   Google reads these as structured data and uses them to render
   rich product snippets in search results (price, availability,
   brand, breadcrumbs). See:
   https://developers.google.com/search/docs/appearance/structured-data/product
*/

function buildProductJsonLd(product: ProductViewModel) {
  const url = `${SITE}/p/${product.slug}`;
  const inStockRetailers = product.retailers.filter(
    (r) => r.inStock && r.price != null,
  );

  // Each retailer becomes an Offer. If none are in stock, mark as OutOfStock
  // on a single placeholder offer (Google requires at least one offer node).
  const offers =
    inStockRetailers.length > 0
      ? inStockRetailers.map((r) => ({
          '@type': 'Offer',
          price: r.price,
          priceCurrency: 'CAD',
          availability: 'https://schema.org/InStock',
          url: r.url ?? url,
          seller: { '@type': 'Organization', name: r.name },
          itemCondition: r.isOpenBox
            ? 'https://schema.org/UsedCondition'
            : 'https://schema.org/NewCondition',
        }))
      : [
          {
            '@type': 'Offer',
            priceCurrency: 'CAD',
            availability: 'https://schema.org/OutOfStock',
            url,
          },
        ];

  // AggregateOffer gives Google the price range at a glance; helpful when
  // multiple retailers are present.
  const aggregateOffer =
    inStockRetailers.length > 1
      ? {
          '@type': 'AggregateOffer',
          priceCurrency: 'CAD',
          lowPrice: Math.min(...inStockRetailers.map((r) => r.price as number)),
          highPrice: Math.max(...inStockRetailers.map((r) => r.price as number)),
          offerCount: inStockRetailers.length,
          availability: 'https://schema.org/InStock',
        }
      : null;

  return {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.title,
    description: product.blurb ?? undefined,
    image: product.imageUrl ?? undefined,
    brand: product.brand
      ? { '@type': 'Brand', name: product.brand }
      : undefined,
    sku: product.sku ?? undefined,
    category: product.category,
    url,
    ...(aggregateOffer ? { offers: aggregateOffer } : { offers }),
  };
}

function buildBreadcrumbJsonLd(product: ProductViewModel) {
  const items = [
    { label: 'Home', href: '/' },
    ...product.breadcrumbs,
    { label: product.title, href: `/p/${product.slug}` },
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

/* ────────────────────────────────────────────────────────────── */

export default async function Page({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const product = await getProductViewModel(slug);
  if (!product) notFound();

  const productLd = buildProductJsonLd(product);
  const breadcrumbLd = buildBreadcrumbJsonLd(product);

  return (
    <>
      {/*
        JSON-LD emitted inline. Next.js streams this with the rest of the
        HTML — Google reads it directly, no client JS required.
      */}
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
      <ProductPage product={product} />
    </>
  );
}

// Revalidate every 5 minutes — scraper cadence is slower than this,
// so no need to hit the DB on every pageview.
export const revalidate = 300;
