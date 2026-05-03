import type { MetadataRoute } from 'next';
import { createAnonSupabaseClient } from '@/lib/supabase/anon';

const URLS_PER_CHUNK = 40_000;
const SUPABASE_PAGE_SIZE = 1_000;

type ProductRow = {
  slug: string;
  updated_at: string | null;
};

export async function generateSitemaps() {
  // Always return one chunk so the request hits the sitemap function.
  // We diagnose inside sitemap() and return the diagnostic in the URL list.
  return [{ id: 0 }];
}

export default async function sitemap({
  id,
}: {
  id: number;
}): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://trackaura.com';
  const diagnostics: string[] = [];

  // Diagnostic 1: env var presence at request time
  const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  diagnostics.push(`env-url-present-${hasUrl}-key-present-${hasKey}`);

  if (!hasUrl || !hasKey) {
    return diagnostics.map((d, i) => ({
      url: `${base}/__diag__/${i}/${encodeURIComponent(d)}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.1,
    }));
  }

  let supabase;
  try {
    supabase = createAnonSupabaseClient();
    diagnostics.push('client-created-ok');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    diagnostics.push(`client-error-${encodeURIComponent(msg).slice(0, 100)}`);
    return diagnostics.map((d, i) => ({
      url: `${base}/__diag__/${i}/${d}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.1,
    }));
  }

  // Diagnostic 2: count query
  const { count, error: countError, status: countStatus } = await supabase
    .from('canonical_products')
    .select('id', { count: 'exact', head: true })
    .not('image_url', 'is', null);

  diagnostics.push(`count-${count}-status-${countStatus}-error-${countError ? encodeURIComponent(JSON.stringify(countError)).slice(0, 100) : 'none'}`);

  // Diagnostic 3: data query (first page only)
  const { data: rows, error: dataError, status: dataStatus } = await supabase
    .from('canonical_products')
    .select('slug, updated_at')
    .not('image_url', 'is', null)
    .order('id', { ascending: true })
    .range(0, SUPABASE_PAGE_SIZE - 1);

  diagnostics.push(`rows-${rows?.length ?? 'null'}-status-${dataStatus}-error-${dataError ? encodeURIComponent(JSON.stringify(dataError)).slice(0, 100) : 'none'}`);

  // If we got actual data, also include the first slug so we can verify it's real
  if (rows && rows.length > 0) {
    diagnostics.push(`first-slug-${rows[0].slug.slice(0, 60)}`);
  }

  return diagnostics.map((d, i) => ({
    url: `${base}/__diag__/${i}/${d}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.1,
  }));
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
