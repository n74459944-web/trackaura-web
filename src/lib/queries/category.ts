import { createClient } from '@/lib/supabase/server';
import { resolveRetailer, RETAILERS, type RetailerKey } from '@/lib/retailers';

/* ──────────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────────── */

export type CategoryProduct = {
  id: number;
  slug: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  msrp: number | null;
  bestPrice: number | null;
  bestRetailerId: RetailerKey | null;
  bestRetailerName: string | null;
  bestRetailerUrl: string | null;
  allTimeLow: number | null;
  allTimeHigh: number | null;
  retailerCount: number;
  inStock: boolean;
  isOpenBox: boolean;
  isAtl: boolean;
};

export type BrandSummary = {
  name: string;
  count: number;
  avgPrice: number;
  minPrice: number;
  atLowestCount: number;
};

export type CategoryStats = {
  totalProducts: number;
  withPrice: number;
  atLowest: number;
  avgPrice: number;
  medianPrice: number;
  retailers: Array<{ id: RetailerKey; name: string; count: number }>;
};

export type CategoryViewModel = {
  slug: string;
  name: string;
  products: CategoryProduct[];
  brands: BrandSummary[];
  stats: CategoryStats;
};

/* ──────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────── */

const CANONICAL_LIMIT = 5_000;
const PRODUCT_ROWS_LIMIT = 25_000;

function prettifyCategorySlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/* ──────────────────────────────────────────────────────────────
   Main query
   ────────────────────────────────────────────────────────────── */

export async function getCategoryViewModel(
  slug: string,
): Promise<CategoryViewModel | null> {
  const supabase = await createClient();

  // 1. Canonical products in this category — image_url filter drops the
  //    "hollow" canonicals that have no meaningful content to render.
  const { data: canonicalRows, error: cErr } = await supabase
    .from('canonical_products')
    .select('id, slug, name, brand, image_url, msrp')
    .eq('category', slug)
    .not('image_url', 'is', null)
    .limit(CANONICAL_LIMIT);

  if (cErr) {
    console.error('[category] canonical_products query failed:', cErr);
    return null;
  }
  if (!canonicalRows || canonicalRows.length === 0) {
    console.warn(`[category] no canonical rows for slug="${slug}"`);
    return null;
  }

  // 2. Linked retailer products — slim columns only. No specs, no description.
  const canonicalIds = canonicalRows.map((c) => c.id);
  const { data: productRows, error: pErr } = await supabase
    .from('products')
    .select(
      'canonical_id, retailer, current_price, min_price, max_price, url, is_openbox',
    )
    .in('canonical_id', canonicalIds)
    .limit(PRODUCT_ROWS_LIMIT);

  if (pErr) {
    console.error('[category] products query failed:', pErr);
    return null;
  }

  // 3. Group linked products by canonical id.
  const productsByCanonical = new Map<number, NonNullable<typeof productRows>>();
  for (const p of productRows ?? []) {
    const arr = productsByCanonical.get(p.canonical_id) ?? [];
    arr.push(p);
    productsByCanonical.set(p.canonical_id, arr);
  }

  // 4. Aggregate per canonical into CategoryProduct.
  const products: CategoryProduct[] = canonicalRows.map((c) => {
    const linked = productsByCanonical.get(c.id) ?? [];
    const inStock = linked.filter((p) => p.current_price != null);

    // Cheapest in-stock, preferring non-openbox.
    const sorted = [...inStock].sort((a, b) => {
      if (a.is_openbox !== b.is_openbox) return a.is_openbox ? 1 : -1;
      return Number(a.current_price) - Number(b.current_price);
    });
    const best = sorted[0] ?? null;
    const bestRetailerCfg = best ? resolveRetailer(best.retailer) : null;
    const bestPrice = best?.current_price != null ? Number(best.current_price) : null;

    // ATL/ATH across all linked products' history (min_price / max_price
    // already carry the full historical extremes per retailer).
    const allPrices = linked
      .flatMap((p) => [
        p.min_price != null ? Number(p.min_price) : null,
        p.max_price != null ? Number(p.max_price) : null,
        p.current_price != null ? Number(p.current_price) : null,
      ])
      .filter((v): v is number => v != null && Number.isFinite(v) && v > 0);

    const allTimeLow = allPrices.length ? Math.min(...allPrices) : null;
    const allTimeHigh = allPrices.length ? Math.max(...allPrices) : null;

    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      brand: c.brand,
      imageUrl: c.image_url,
      msrp: c.msrp != null ? Number(c.msrp) : null,
      bestPrice,
      bestRetailerId: bestRetailerCfg?.id ?? null,
      bestRetailerName: bestRetailerCfg?.name ?? null,
      bestRetailerUrl: best?.url ?? null,
      allTimeLow,
      allTimeHigh,
      retailerCount: linked.length,
      inStock: inStock.length > 0,
      isOpenBox: best?.is_openbox ?? false,
      isAtl:
        bestPrice != null && allTimeLow != null && bestPrice <= allTimeLow,
    };
  });

  // 5. Category-level stats.
  const withPrice = products.filter((p) => p.bestPrice != null);
  const sortedPrices = withPrice
    .map((p) => p.bestPrice as number)
    .sort((a, b) => a - b);
  const avgPrice = sortedPrices.length
    ? Math.round(sortedPrices.reduce((s, v) => s + v, 0) / sortedPrices.length)
    : 0;
  const medianPrice = sortedPrices.length
    ? sortedPrices[Math.floor(sortedPrices.length / 2)]
    : 0;
  const atLowestCount = products.filter((p) => p.isAtl && p.inStock).length;

  // Retailer counts across all linked products in category.
  const retailerCounts = new Map<RetailerKey, number>();
  for (const p of productRows ?? []) {
    const cfg = resolveRetailer(p.retailer);
    if (cfg.id === 'unknown') continue;
    retailerCounts.set(cfg.id, (retailerCounts.get(cfg.id) ?? 0) + 1);
  }
  const retailers = [...retailerCounts.entries()]
    .map(([id, count]) => ({ id, name: RETAILERS[id].name, count }))
    .sort((a, b) => b.count - a.count);

  // 6. Brand summaries. Filter out obvious noise and one-offs.
  const brandMap = new Map<
    string,
    { count: number; prices: number[]; atLowest: number }
  >();
  for (const p of products) {
    if (!p.brand) continue;
    const b =
      brandMap.get(p.brand) ?? { count: 0, prices: [], atLowest: 0 };
    b.count += 1;
    if (p.bestPrice != null) b.prices.push(p.bestPrice);
    if (p.isAtl && p.inStock) b.atLowest += 1;
    brandMap.set(p.brand, b);
  }
  const brands: BrandSummary[] = [...brandMap.entries()]
    .filter(
      ([name, b]) =>
        b.count >= 2 &&
        name.length >= 2 &&
        !/^\d+$/.test(name) &&
        name !== 'Unknown',
    )
    .map(([name, b]) => ({
      name,
      count: b.count,
      avgPrice: b.prices.length
        ? Math.round(b.prices.reduce((s, v) => s + v, 0) / b.prices.length)
        : 0,
      minPrice: b.prices.length ? Math.min(...b.prices) : 0,
      atLowestCount: b.atLowest,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    slug,
    name: prettifyCategorySlug(slug),
    products,
    brands,
    stats: {
      totalProducts: products.length,
      withPrice: withPrice.length,
      atLowest: atLowestCount,
      avgPrice,
      medianPrice,
      retailers,
    },
  };
}
