import { createClient } from '@/lib/supabase/server';
import type { Product } from '@/types';

export type ProductsFilters = {
  category?: string;
  retailer?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  page?: number;
  pageSize?: number;
};

export type ProductsResult = {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
};

const DEFAULT_PAGE_SIZE = 48;

/**
 * Server-side product listing query.
 *
 * Calls the products_filtered Postgres RPC which does filter → join →
 * count → sort → paginate in a single statement. Returns a page of
 * canonical products (one row per product, not per retailer) plus the
 * total match count for pagination UI.
 *
 * Matches the Product shape consumed by <ProductCard/> so the existing
 * ProductsClient.tsx keeps working unchanged.
 */
export async function getFilteredProducts(
  filters: ProductsFilters,
): Promise<ProductsResult> {
  const supabase = await createClient();

  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const page = Math.max(1, filters.page ?? 1);

  const { data, error } = await supabase.rpc('products_filtered', {
    p_category: filters.category === 'all' ? null : filters.category ?? null,
    p_retailer: filters.retailer === 'all' ? null : filters.retailer ?? null,
    p_search: filters.search?.trim() || null,
    p_min_price: filters.minPrice ?? null,
    p_max_price: filters.maxPrice ?? null,
    p_sort: filters.sort || 'biggest-drop',
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) {
    console.error('[products] RPC failed:', error);
    return { products: [], total: 0, page, totalPages: 0 };
  }

  if (!data || data.length === 0) {
    return { products: [], total: 0, page, totalPages: 0 };
  }

  type RpcRow = {
    id: number;
    slug: string;
    name: string;
    brand: string | null;
    category: string;
    image_url: string | null;
    current_price: number;
    min_price: number;
    max_price: number;
    retailer: string;
    url: string | null;
    is_openbox: boolean;
    total_count: number;
  };

  const rows = data as RpcRow[];
  const total = Number(rows[0].total_count);

  const nowIso = new Date().toISOString();

  // Map RPC rows to the frontend Product type. Fields not populated by
  // the canonical listing (priceCount, firstSeen, specs, etc.) are set to
  // sensible defaults — ProductCard only reads the core display fields.
  const products: Product[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    retailer: r.retailer,
    url: r.url ?? undefined,
    category: r.category,
    brand: r.brand ?? undefined,
    imageUrl: r.image_url ?? undefined,
    currentPrice: Number(r.current_price),
    minPrice: Number(r.min_price),
    maxPrice: Number(r.max_price),
    priceCount: 0,
    isOpenbox: r.is_openbox,
    firstSeen: nowIso,
    lastUpdated: nowIso,
  }) as unknown as Product);

  return {
    products,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
