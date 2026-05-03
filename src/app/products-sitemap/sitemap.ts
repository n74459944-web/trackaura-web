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
 * Forced to run at request time (not build time) so we can see logs
 * and so a transient backend issue at build time doesn't bake an empty
 * sitemap into the deployment for 24 hours.
 */
export async function generateSitemaps() {
  const reqId = Math.random().toString(36).slice(2, 8);
  console.log(`[sitemap:${reqId}] generateSitemaps START`);

  const supabase = createAnonSupabaseClient();
  const { count, error } = await supabase
    .from('canonical_products')
    .select('id', { count: 'exact', head: true })
    .not('image_url', 'is', null);

  if (error) {
    console.error(`[sitemap:${reqId}] generateSitemaps count error:`, JSON.stringify(error));
  }
  console.log(`[sitemap:${reqId}] generateSitemaps count=${count}`);

  const productCount = count ?? 0;
  const chunkCount = Math.max(1, Math.ceil(productCount / URLS_PER_CHUNK));
  const result = Array.from({ length: chunkCount }, (_, i) => ({ id: i }));
  console.log(`[sitemap:${reqId}] generateSitemaps returning ${chunkCount} chunks`);
  return result;
}

export default async function sitemap({
  id,
}: {
  id: number;
}): Promise<MetadataRoute.Sitemap> {
  const reqId = Math.random().toString(36).slice(2, 8);
  console.log(`[sitemap:${reqId}] sitemap chunk=${id} START`);

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
    console.log(`[sitemap:${reqId}] page ${pageNum} fetching range ${pageStart}-${pageEnd}`);

    const { data: rows, error } = await supabase
      .from('canonical_products')
      .select('slug, updated_at')
      .not('image_url', 'is', null)
      .order('id', { ascending: true })
      .range(pageStart, pageEnd);

    if (error) {
      console.error(`[sitemap:${reqId}] page ${pageNum} error:`, JSON.stringify(error));
      break;
    }

    if (!rows || rows.length === 0) {
      console.log(`[sitemap:${reqId}] page ${pageNum} empty, stopping`);
      break;
    }

    allRows.push(...rows);
    console.log(`[sitemap:${reqId}] page ${pageNum} got ${rows.length} rows (total: ${allRows.length})`);

    if (rows.length < pageEnd - pageStart + 1) {
      console.log(`[sitemap:${reqId}] short read, stopping`);
      break;
    }

    pageStart += SUPABASE_PAGE_SIZE;
    pageNum += 1;
  }

  console.log(`[sitemap:${reqId}] sitemap chunk=${id} DONE total=${allRows.length}`);

  return allRows.map((r) => ({
    url: `${base}/p/${r.slug}`,
    lastModified: r.updated_at ? new Date(r.updated_at) : new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));
}

// Force every request to execute the route fresh. We've been chasing a
// build-cache ghost; this kills the ambiguity. CDN/edge caching still
// applies via Cache-Control headers Next.js sets at the response layer.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
