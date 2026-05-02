// src/lib/chip/slug-resolver.ts
//
// Resolves a public chip slug (e.g. "rtx-5090") to a canonical_entities row.
// DB slugs are stored in the brand-prefixed form ("nvidia-geforce-rtx-5090").
// Public URLs emit the clean form. On lookup miss, we try each known brand
// prefix. Same shape as src/app/p/[slug]/page.tsx's dedupe-first-segment logic.
//
// One query (IN-filter on candidate slugs) covers both the direct and fallback
// cases. Direct match always wins if the DB happens to hold a clean slug.
//
// resolveChipBySlug is wrapped with React.cache so generateMetadata and the
// page render dedupe their lookups within a single request. The cache key is
// the slug string (value equality on primitives), so this is straightforward.

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

const BRAND_PREFIXES = [
  'nvidia-geforce-',
  'amd-radeon-',
  'intel-arc-',
] as const;

export type ChipEntity = {
  id: string;
  slug: string;
  canonical_name: string;
  display_name: string | null;
  brand: string | null;
  release_date: string | null;
  msrp_cad: number | null;
  image_primary_url: string | null;
  description_md: string | null;
  entity_type: string;
  vertical: string;
};

export type ResolveResult = {
  chip: ChipEntity | null;
  /**
   * The clean public slug for this chip. Always equals the input slug when a
   * chip is found via brand-prefix fallback. Null when the DB slug was already
   * clean (no rewrite needed) or the chip was not found.
   */
  publicSlug: string | null;
};

export const resolveChipBySlug = cache(
  async (slug: string): Promise<ResolveResult> => {
    const supabase = await createClient();

    const candidates = [slug, ...BRAND_PREFIXES.map((p) => `${p}${slug}`)];

    const { data: matches, error } = await supabase
      .from('canonical_entities')
      .select(
        'id, slug, canonical_name, display_name, brand, release_date, msrp_cad, image_primary_url, description_md, entity_type, vertical',
      )
      .in('slug', candidates)
      .eq('entity_type', 'gpu_chip');

    if (error || !matches || matches.length === 0) {
      return { chip: null, publicSlug: null };
    }

    // Prefer exact-match (DB slug already clean).
    const direct = matches.find((m) => m.slug === slug);
    if (direct) return { chip: direct, publicSlug: slug };

    // First prefix match wins; public URL is the requested clean slug.
    return { chip: matches[0], publicSlug: slug };
  },
);

/**
 * Strip a known brand prefix from a DB slug to produce the clean public slug.
 * Used for canonical-link emission and for converting board lookups in
 * downstream code that may receive DB-shaped slugs.
 *
 * Pure function — no caching needed.
 */
export function publicSlugFromDbSlug(dbSlug: string): string {
  for (const prefix of BRAND_PREFIXES) {
    if (dbSlug.startsWith(prefix)) {
      return dbSlug.slice(prefix.length);
    }
  }
  return dbSlug;
}
