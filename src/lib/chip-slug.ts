import { createClient } from '@/lib/supabase/server';
import {
  BRAND_PREFIXES,
  cleanChipSlug,
} from '@/lib/chip-slug-helpers';

// Re-export for server-side callers that have been importing from here.
// Client components MUST import from chip-slug-helpers directly — this
// module pulls in the Supabase server client (via next/headers) and will
// break a client-bundled build if imported anywhere with 'use client'.
export { cleanChipSlug };

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

   The brand-prefix list lives in chip-slug-helpers.ts so client
   components can use it without dragging server-only deps into their
   bundle.
   ──────────────────────────────────────────────────────────────────────── */

export type ChipSlugResolution = {
  entityId: string | null;
  cleanSlug: string;
  needsRedirect: boolean;
};

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
    const cleaned = cleanChipSlug(requestedSlug);
    return {
      entityId: exact.id,
      cleanSlug: cleaned,
      needsRedirect: cleaned !== requestedSlug,
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
