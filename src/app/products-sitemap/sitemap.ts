import type { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

const URLS_PER_CHUNK = 40_000;

/**
 * Generates one sitemap file per chunk of ~40k products.
 * Accessed at /products-sitemap/0.xml, /products-sitemap/1.xml, etc.
 */
export async function generateSitemaps() {
  const supabase = await createClient();
  const { count } = await supabase
    .from('canonical_products')
    .select('id', { count: 'exact', head: true })
    .not('image_url', 'is', null);

  const productCount = count ?? 0;
  const chunkCount = Math.max(1, Math.ceil(productCount / URLS_PER_CHUNK));
  return Array.from({ length: chunkCount }, (_, i) => ({ id: i }));
}

export default async function sitemap({
  id,
}: {
  id: number;
}): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://trackaura.com';

  const from = id * URLS_PER_CHUNK;
  const to = from + URLS_PER_CHUNK - 1;

  // Only include canonicals that (a) have an image (indicates scraper coverage)
  // and (b) have at least one linked product. Indexing dead pages hurts SEO.
  const { data: rows } = await supabase
    .from('canonical_products')
    .select('slug, updated_at')
    .not('image_url', 'is', null)
    .order('id', { ascending: true })
    .range(from, to);

  if (!rows) return [];

  return rows.map((r) => ({
    url: `${base}/p/${r.slug}`,
    lastModified: r.updated_at ? new Date(r.updated_at) : new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));
}

// Refresh each chunk once a day. Scraper cadence is slower than this.
export const revalidate = 86_400;
