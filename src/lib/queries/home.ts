import { createClient } from '@/lib/supabase/server';
import { resolveRetailer, type RetailerKey } from '@/lib/retailers';

/* ──────────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────────── */

export type HomeCategory = {
  key: string;
  label: string;
  count: number;
  atLowest: number;
};

export type HomeFeaturedProduct = {
  id: number;
  slug: string;
  name: string;
  brand: string | null;
  category: string;
  imageUrl: string | null;
  bestPrice: number;
  allTimeLow: number;
  allTimeHigh: number;
  savings: number;
  dropPct: number;
  bestRetailerId: RetailerKey | null;
  bestRetailerName: string | null;
  isAtl: boolean;
};

export type HomeRecentDrop = {
  productSlug: string;
  productName: string;
  category: string;
  retailerId: RetailerKey;
  retailerName: string;
  oldPrice: number;
  newPrice: number;
  pct: number;
  when: string;
};

export type HomeStats = {
  totalProducts: number;
  totalRetailers: number;
  categoriesTracked: number;
};

/* ──────────────────────────────────────────────────────────────
   Utils
   ────────────────────────────────────────────────────────────── */

function prettify(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function formatRelative(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = 60_000, h = 60 * m, d = 24 * h;
  if (diff < h) return `${Math.max(1, Math.round(diff / m))}m ago`;
  if (diff < d) return `${Math.round(diff / h)}h ago`;
  return `${Math.round(diff / d)}d ago`;
}

/* ──────────────────────────────────────────────────────────────
   Home stats
   ────────────────────────────────────────────────────────────── */

export async function getHomeStats(): Promise<HomeStats> {
  const supabase = await createClient();

  // All three in parallel. Each is a HEAD request (count only), so the
  // cost is a row count, not fetching rows.
  const [canonicalCount, retailersData, categoriesData] = await Promise.all([
    supabase
      .from('canonical_products')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('products')
      .select('retailer')
      .not('retailer', 'is', null)
      .limit(50_000),
    supabase
      .from('canonical_products')
      .select('category')
      .not('category', 'is', null)
      .limit(50_000),
  ]);

  const distinctRetailers = new Set<string>();
  for (const row of retailersData.data ?? []) {
    const cfg = resolveRetailer(row.retailer);
    if (cfg.id !== 'unknown') distinctRetailers.add(cfg.id);
  }

  const distinctCategories = new Set<string>();
  for (const row of categoriesData.data ?? []) {
    if (row.category && row.category !== 'other')
      distinctCategories.add(row.category);
  }

  return {
    totalProducts: canonicalCount.count ?? 0,
    totalRetailers: distinctRetailers.size,
    categoriesTracked: distinctCategories.size,
  };
}

/* ──────────────────────────────────────────────────────────────
   Top categories
   ────────────────────────────────────────────────────────────── */

export async function getHomeCategories(
  limit: number = 12,
): Promise<HomeCategory[]> {
  const supabase = await createClient();

  // Aggregation happens server-side via the home_top_categories RPC
  // (defined in home_rpcs.sql). Avoids Supabase's default row cap on
  // plain SELECTs and keeps the payload tiny.
  const { data, error } = await supabase.rpc('home_top_categories', {
    result_limit: limit,
  });

  if (error) {
    console.error('[home] categories RPC failed:', error);
    return [];
  }
  if (!data) return [];

  return (data as Array<{ category: string; cnt: number }>).map((row) => ({
    key: row.category,
    label: prettify(row.category),
    count: Number(row.cnt),
    atLowest: 0,
  }));
}

/* ──────────────────────────────────────────────────────────────
   Featured deals
   ────────────────────────────────────────────────────────────── */

const SKIP_KEYWORDS = [
  'server', 'enterprise', 'hpe ', 'proliant', 'rack mount',
  'ecc reg', 'registered', 'refurbished', 'open box',
  'replacement', 'spare', 'oem', 'bulk pack',
  'keycap', 'key cap', 'wrist rest', 'cable', 'adapter',
  'dongle', 'converter', 'extension', 'splitter',
];

export async function getFeaturedDeals(
  count: number = 6,
): Promise<HomeFeaturedProduct[]> {
  const supabase = await createClient();

  // Aggregation + join + drop% ranking all happen server-side via the
  // home_featured_deals RPC. Postgres returns 40 pre-ranked candidates;
  // we filter skip keywords + do round-robin category selection in Node.
  const { data, error } = await supabase.rpc('home_featured_deals', {
    candidate_limit: 40,
  });

  if (error) {
    console.error('[home] featured deals RPC failed:', error);
    return [];
  }
  if (!data) return [];

  type RpcRow = {
    canonical_id: number;
    slug: string;
    name: string;
    brand: string | null;
    category: string;
    image_url: string | null;
    current_price: number;
    min_price: number;
    max_price: number;
    retailer: string;
    drop_pct: number;
  };

  
  console.log('[home] featured RPC returned', (data as unknown[]).length, 'rows');
  const scored: HomeFeaturedProduct[] = [];
  for (const row of data as RpcRow[]) {
    const nameLower = row.name.toLowerCase();
    if (SKIP_KEYWORDS.some((kw) => nameLower.includes(kw))) continue;
    if (row.name.trim().split(/\s+/).length < 3) continue;

    const curr = Number(row.current_price);
    const min = Number(row.min_price);
    const max = Number(row.max_price);
    const retailerCfg = resolveRetailer(row.retailer);

    scored.push({
      id: row.canonical_id,
      slug: row.slug,
      name: row.name,
      brand: row.brand,
      category: row.category,
      imageUrl: row.image_url,
      bestPrice: curr,
      allTimeLow: min,
      allTimeHigh: max,
      savings: max - curr,
      dropPct: Number(row.drop_pct),
      bestRetailerId: retailerCfg.id !== 'unknown' ? retailerCfg.id : null,
      bestRetailerName: retailerCfg.id !== 'unknown' ? retailerCfg.name : null,
      isAtl: curr <= min,
    });
  }

  // Round-robin by category so one category can't hog the feature strip.
  const byCategory = new Map<string, HomeFeaturedProduct[]>();
  for (const p of scored) {
    const arr = byCategory.get(p.category) ?? [];
    arr.push(p);
    byCategory.set(p.category, arr);
  }

  const categoryOrder = [...byCategory.keys()].sort((a, b) => {
    const topA = byCategory.get(a)![0].dropPct;
    const topB = byCategory.get(b)![0].dropPct;
    return topB - topA;
  });

  const featured: HomeFeaturedProduct[] = [];
  for (let round = 0; featured.length < count && round < 4; round++) {
    for (const cat of categoryOrder) {
      if (featured.length >= count) break;
      const p = byCategory.get(cat)?.[round];
      if (p) featured.push(p);
    }
  }
  return featured;
}

/* ──────────────────────────────────────────────────────────────
   Recent price drops
   ────────────────────────────────────────────────────────────── */

export async function getRecentDrops(limit: number = 6): Promise<HomeRecentDrop[]> {
  const supabase = await createClient();

  // Pull the 500 newest price points with enough context to detect drops.
  // We join to products (which carries retailer + url + name via its own
  // canonical_id link) in two fetches to keep column footprint tiny.
  const { data: points } = await supabase
    .from('price_points')
    .select('product_id, price, timestamp')
    .order('timestamp', { ascending: false })
    .limit(500);

  if (!points || points.length === 0) return [];

  // Group by product to find (previous, current) pairs.
  const byProduct = new Map<number, typeof points>();
  for (const p of points) {
    const arr = byProduct.get(p.product_id) ?? [];
    arr.push(p);
    byProduct.set(p.product_id, arr);
  }

  // Collect (product_id, drop) candidates.
  type Drop = {
    productId: number;
    oldPrice: number;
    newPrice: number;
    pct: number;
    dollars: number;
    timestamp: string;
  };
  const drops: Drop[] = [];
  for (const [productId, arr] of byProduct) {
    if (arr.length < 2) continue;
    // arr is newest-first; current = arr[0], previous = arr[1]
    const curr = Number(arr[0].price);
    const prev = Number(arr[1].price);
    if (!(prev > 0 && curr < prev)) continue;
    const pct = ((prev - curr) / prev) * 100;
    const dollars = prev - curr;
    // Filter out noise
    if (pct < 2 || dollars < 2) continue;
    drops.push({
      productId,
      oldPrice: prev,
      newPrice: curr,
      pct,
      dollars,
      timestamp: arr[0].timestamp,
    });
  }

  drops.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const top = drops.slice(0, limit * 3); // oversample to survive join losses

  if (top.length === 0) return [];

  // Second query: fetch product + canonical info for only the winners.
  const productIds = top.map((d) => d.productId);
  const { data: productRows } = await supabase
    .from('products')
    .select('id, retailer, canonical_id')
    .in('id', productIds);

  if (!productRows) return [];

  const canonicalIds = productRows
    .map((p) => p.canonical_id)
    .filter((id): id is number => id != null);

  const { data: canonicalRows } = await supabase
    .from('canonical_products')
    .select('id, slug, name, category')
    .in('id', canonicalIds);

  const productById = new Map(productRows.map((p) => [p.id, p]));
  const canonicalById = new Map((canonicalRows ?? []).map((c) => [c.id, c]));

  const result: HomeRecentDrop[] = [];
  for (const d of top) {
    if (result.length >= limit) break;
    const product = productById.get(d.productId);
    if (!product) continue;
    const canonical = product.canonical_id
      ? canonicalById.get(product.canonical_id)
      : null;
    if (!canonical) continue;

    const retailerCfg = resolveRetailer(product.retailer);
    if (retailerCfg.id === 'unknown') continue;

    result.push({
      productSlug: canonical.slug,
      productName: canonical.name,
      category: canonical.category,
      retailerId: retailerCfg.id,
      retailerName: retailerCfg.name,
      oldPrice: d.oldPrice,
      newPrice: d.newPrice,
      pct: d.pct,
      when: formatRelative(d.timestamp),
    });
  }
  return result;
}
