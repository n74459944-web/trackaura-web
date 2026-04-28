import { createClient } from '@/lib/supabase/server';

/* ────────────────────────────────────────────────────────────────────────
   Chip slug resolution

   Background: canonical_entities slugs for entity_type='gpu_chip' are
   stored with brand prefixes (e.g. 'nvidia-geforce-rtx-5090'). Public
   chip URLs are emitted in clean form (/chip/rtx-5090) for SEO and
   readability. Decision locked 2026-04-27 (Architecture Bible §7).

   Resolver behaviour mirrors the /p/[slug] dedupe pattern:
     1. Try the slug exactly as requested. Covers DB-form bookmarks and
        any future chips whose slug is genuinely unprefixed.
     2. On miss, try each known brand prefix prepended in a single
        batched query. Covers the common case: clean URL ('rtx-5090')
        → DB row ('nvidia-geforce-rtx-5090').
     3. If the requested slug already had a brand prefix and matched in
        step 1, flag for redirect to the clean form.

   DB stays untouched. Brand-prefix list is closed under known consumer
   GPU manufacturers; expand if Phase 0 picks up a new one.
   ──────────────────────────────────────────────────────────────────────── */

const BRAND_PREFIXES = [
  'nvidia-geforce-',
  'amd-radeon-',
  'intel-arc-',
] as const;

export type ChipSlugResolution = {
  entityId: string | null;
  cleanSlug: string;
  needsRedirect: boolean;
};

function stripBrandPrefix(slug: string): string | null {
  for (const prefix of BRAND_PREFIXES) {
    if (slug.startsWith(prefix)) return slug.slice(prefix.length);
  }
  return null;
}

export async function resolveChipSlug(
  requestedSlug: string,
): Promise<ChipSlugResolution> {
  const supabase = await createClient();

  // 1. Try the slug exactly as requested.
  const { data: exact, error: exactErr } = await supabase
    .from('canonical_entities')
    .select('id, slug')
    .eq('slug', requestedSlug)
    .eq('entity_type', 'gpu_chip')
    .maybeSingle();

  if (exactErr) {
    console.error('[chip-slug] exact-match query failed:', exactErr);
    return { entityId: null, cleanSlug: requestedSlug, needsRedirect: false };
  }

  if (exact) {
    const cleaned = stripBrandPrefix(requestedSlug);
    if (cleaned !== null) {
      // Brand-prefix request hit a brand-prefix DB row → redirect to clean.
      return { entityId: exact.id, cleanSlug: cleaned, needsRedirect: true };
    }
    // No brand prefix on the request → already at the canonical URL.
    return {
      entityId: exact.id,
      cleanSlug: requestedSlug,
      needsRedirect: false,
    };
  }

  // 2. Miss. Try each brand prefix in a single batched query.
  const candidates = BRAND_PREFIXES.map((p) => `${p}${requestedSlug}`);
  const { data: prefixed, error: prefixedErr } = await supabase
    .from('canonical_entities')
    .select('id, slug')
    .in('slug', candidates)
    .eq('entity_type', 'gpu_chip')
    .limit(1);

  if (prefixedErr) {
    console.error('[chip-slug] prefix-fallback query failed:', prefixedErr);
    return { entityId: null, cleanSlug: requestedSlug, needsRedirect: false };
  }

  if (prefixed && prefixed.length > 0) {
    return {
      entityId: prefixed[0].id,
      cleanSlug: requestedSlug,
      needsRedirect: false,
    };
  }

  // 3. Genuine miss.
  return { entityId: null, cleanSlug: requestedSlug, needsRedirect: false };
}
