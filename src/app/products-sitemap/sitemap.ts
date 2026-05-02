import type { MetadataRoute } from 'next';
import { createAnonSupabaseClient } from '@/lib/supabase/anon';

const URLS_PER_CHUNK = 40_000;

// PostgREST's default `max-rows` is 1000. A single supabase-js
// `.range(0, 39999)` request is silently capped at 1000 rows. We
// paginate explicitly within each chunk to fetch everything.
const SUPABASE_PAGE_SIZE = 1_000;

type ProductRow = {
  slug: string;
  updated_at: string | null;
};

/**
 * Generates one sitemap file per chunk of ~40k products.
 * Accessed at /products-sitemap/sitemap/0.xml, /products-sitemap/sitemap/1.xml, etc.
 *
 * Uses the anon client (no cookies) because sitemaps run during build-time
 * static generation — cookies() isn't available in that context.
 */
export async function generateSitemaps() {
  const supabase = createAnonSupabaseClient();
  const { count, error } = await supabase
    .from('canonical_products')
    .select('id', { count: 'exact', head: true })
    .not('image_url', 'is', null);

  if (error) {
    console.error('[sitemap] generateSitemaps count query failed:', error);
  }
  console.log('[sitemap] generateSitemaps productCount:', count);

  const productCount = count ?? 0;
  const chunkCount = Math.max(1, Math.ceil(productCount / URLS_PER_CHUNK));
  return Array.from({ length: chunkCount }, (_, i) => ({ id: i }));
}

export default async function sitemap({
  id,
}: {
  id: number;
}): Promise<MetadataRoute.Sitemap> {
  const supabase = createAnonSupabaseClient();
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://trackaura.com';
  const chunkStart = id * URLS_PER_CHUNK;
  const chunkEnd = chunkStart + URLS_PER_CHUNK - 1;

  // Paginate within the chunk to bypass PostgREST's max-rows cap.
  const allRows: ProductRow[] = [];
  let pageStart = chunkStart;
  let pageNum = 0;

  while (pageStart <= chunkEnd) {
    const pageEnd = Math.min(pageStart + SUPABASE_PAGE_SIZE - 1, chunkEnd);

    const { data: rows, error } = await supabase
      .from('canonical_products')
      .select('slug, updated_at')
      .not('image_url', 'is', null)
      .order('id', { ascending: true })
      .range(pageStart, pageEnd);

    if (error) {
      console.error('[sitemap] page query failed', {
        chunkId: id,
        pageNum,
        pageStart,
        pageEnd,
        error,
      });
      break;
    }

    if (!rows || rows.length === 0) {
      break;
    }

    allRows.push(...rows);

    // Last page: short read means we've hit the end of the result set.
    if (rows.length < pageEnd - pageStart + 1) {
      break;
    }

    pageStart += SUPABASE_PAGE_SIZE;
    pageNum += 1;
  }

  console.log('[sitemap] chunk', id, 'fetched', allRows.length, 'rows across', pageNum + 1, 'pages');

  return allRows.map((r) => ({
    url: `${base}/p/${r.slug}`,
    lastModified: r.updated_at ? new Date(r.updated_at) : new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));
}

// Refresh each chunk once a day. Scraper cadence is slower than this.
export const revalidate = 86_400;
