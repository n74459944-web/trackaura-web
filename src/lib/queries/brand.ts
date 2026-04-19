import { createClient } from '@/lib/supabase/server';
import { resolveRetailer, RETAILERS, type RetailerKey } from '@/lib/retailers';
import type { CategoryProduct } from '@/lib/queries/category';

/* ──────────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────────── */

export type BrandInCategoryViewModel = {
  categorySlug: string;
  categoryName: string;
  brandSlug: string;
  brandName: string;
  products: CategoryProduct[];
  stats: {
    totalProducts: number;
    withPrice: number;
    atLowest: number;
    avgPrice: number;
    medianPrice: number;
    retailers: Array<{ id: RetailerKey; name: string; count: number }>;
  };
  siblingBrands: Array<{ name: string; slug: string; count: number }>;
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

export function brandToSlug(brand: string): string {
  return brand
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Convert a brand slug back into candidate brand names. The brand column
 * has mixed casing ("YEALINK", "Yealink", "NVIDIA") and may contain
 * non-slug characters, so we can't do an exact lookup by slugified name.
 * Instead we fetch the distinct brands for the category and match by slug.
 */
async function resolveBrandName(
  categorySlug: string,
  brandSlug: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('canonical_products')
    .select('brand')
    .eq('category', categorySlug)
    .not('brand', 'is', null)
    .limit(50_000);

  if (!data) return null;
  const seen = new Set<string>();
  for (const row of data) {
    const b = row.brand as string | null;
    if (!b || seen.has(b)) continue;
    seen.add(b);
    if (brandToSlug(b) === brandSlug) return b;
  }
  return null;
}

/* ──────────────────────────────────────────────────────────────
   Main query
   ────────────────────────────────────────────────────────────── */

export async function getBrandInCategoryViewModel(
  categorySlug: string,
  brandSlug: string,
): Promise<BrandInCategoryViewModel | null> {
  const supabase = await createClient();

  // 1. Resolve brand slug → canonical brand name (case-preserving).
  const brandName = await resolveBrandName(categorySlug, brandSlug);
  if (!brandName) {
    console.warn(
      `[brand] no brand matching slug="${brandSlug}" in category="${categorySlug}"`,
    );
    return null;
  }

  // 2. Canonical products in this category + brand.
  const { data: canonicalRows, error: cErr } = await supabase
    .from('canonical_products')
    .select('id, slug, name, brand, image_url, msrp')
    .eq('category', categorySlug)
    .eq('brand', brandName)
    .not('image_url', 'is', null)
    .limit(CANONICAL_LIMIT);

  if (cErr) {
    console.error('[brand] canonical_products query failed:', cErr);
    return null;
  }
  if (!canonicalRows || canonicalRows.length === 0) {
    console.warn(
      `[brand] no canonical rows for brand="${brandName}" category="${categorySlug}"`,
    );
    return null;
  }

  // 3. Linked retailer products, slim columns only.
  const canonicalIds = canonicalRows.map((c) => c.id);
  const { data: productRows, error: pErr } = await supabase
    .from('products')
    .select(
      'canonical_id, retailer, current_price, min_price, max_price, url, is_openbox',
    )
    .in('canonical_id', canonicalIds)
    .limit(PRODUCT_ROWS_LIMIT);

  if (pErr) {
    console.error('[brand] products query failed:', pErr);
    return null;
  }

  // 4. Group per canonical.
  const productsByCanonical = new Map<number, NonNullable<typeof productRows>>();
  for (const p of productRows ?? []) {
    const arr = productsByCanonical.get(p.canonical_id) ?? [];
    arr.push(p);
    productsByCanonical.set(p.canonical_id, arr);
  }

  // 5. Aggregate into CategoryProduct shape (reuses the card component).
  const products: CategoryProduct[] = canonicalRows.map((c) => {
    const linked = productsByCanonical.get(c.id) ?? [];
    const inStock = linked.filter((p) => p.current_price != null);

    const sorted = [...inStock].sort((a, b) => {
      if (a.is_openbox !== b.is_openbox) return a.is_openbox ? 1 : -1;
      return Number(a.current_price) - Number(b.current_price);
    });
    const best = sorted[0] ?? null;
    const bestRetailerCfg = best ? resolveRetailer(best.retailer) : null;
    const bestPrice =
      best?.current_price != null ? Number(best.current_price) : null;

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

  // 6. Stats (same shape as category).
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

  const retailerCounts = new Map<RetailerKey, number>();
  for (const p of productRows ?? []) {
    const cfg = resolveRetailer(p.retailer);
    if (cfg.id === 'unknown') continue;
    retailerCounts.set(cfg.id, (retailerCounts.get(cfg.id) ?? 0) + 1);
  }
  const retailers = [...retailerCounts.entries()]
    .map(([id, count]) => ({ id, name: RETAILERS[id].name, count }))
    .sort((a, b) => b.count - a.count);

  // 7. Sibling brands: other brands in this category for the nav strip.
  const { data: siblingRows } = await supabase
    .from('canonical_products')
    .select('brand')
    .eq('category', categorySlug)
    .not('brand', 'is', null)
    .not('image_url', 'is', null);

  const siblingMap = new Map<string, number>();
  for (const r of siblingRows ?? []) {
    const b = r.brand as string | null;
    if (!b) continue;
    siblingMap.set(b, (siblingMap.get(b) ?? 0) + 1);
  }
  const siblingBrands = [...siblingMap.entries()]
    .filter(([name, c]) => name !== brandName && c >= 2 && name.length >= 2)
    .map(([name, count]) => ({ name, slug: brandToSlug(name), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return {
    categorySlug,
    categoryName: prettifyCategorySlug(categorySlug),
    brandSlug,
    brandName,
    products,
    stats: {
      totalProducts: products.length,
      withPrice: withPrice.length,
      atLowest: atLowestCount,
      avgPrice,
      medianPrice,
      retailers,
    },
    siblingBrands,
  };
}
