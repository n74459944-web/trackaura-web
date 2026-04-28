/* ────────────────────────────────────────────────────────────────────────
   Pure helpers for chip slug brand-prefix handling.

   Split from chip-slug.ts because that module imports the Supabase
   server client (which uses `next/headers` and is server-only). When a
   client component imports from chip-slug.ts, the bundler pulls the
   entire module's imports into the client bundle — including
   `next/headers` — and the build fails.

   Anything in this file is import-safe in both server and client code.
   The brand-prefix list lives here as the single source of truth;
   chip-slug.ts re-exports `cleanChipSlug` for backwards compatibility
   with server-side callers.

   Imports:
     server-side resolver (chip-slug.ts) → here
     client component   (ChipParentSection.tsx) → here, directly
     server query       (queries/chip.ts) → chip-slug.ts (re-export)
   ──────────────────────────────────────────────────────────────────────── */

export const BRAND_PREFIXES = [
  'nvidia-geforce-',
  'amd-radeon-',
  'intel-arc-',
] as const;

/**
 * Strip a known GPU brand prefix from a chip slug.
 *
 *   nvidia-geforce-rtx-5090 → rtx-5090
 *   rx-9070-xt              → rx-9070-xt  (no change)
 *
 * Returns the slug as-is when no prefix matches. Used for public URL
 * emission, brand-prefix redirect detection, and cross-page links from
 * the product page to the chip hub.
 */
export function cleanChipSlug(slug: string): string {
  for (const prefix of BRAND_PREFIXES) {
    if (slug.startsWith(prefix)) return slug.slice(prefix.length);
  }
  return slug;
}
