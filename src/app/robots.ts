import type { MetadataRoute } from 'next';
import {
  ALLOWED_SEARCH_ENGINES,
  ALLOWED_AI_CITATION_BOTS,
} from '@/lib/bot-policy';

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://trackaura.com';

/**
 * Crawler policy — three audiences:
 *
 * 1. Search engines (Google, Bing, DuckDuckGo, Yandex)
 *    Drive Phase 0 SEO. Full access except internal routes.
 *
 * 2. AI citation crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.)
 *    Drive ~5% of active users today via citations in ChatGPT/Claude/
 *    Perplexity answers. Full access except internal routes.
 *
 * 3. Everyone else (default)
 *    Allowed to see homepage, blog, trends, about — i.e. enough to
 *    know TrackAura exists. Disallowed from /p/ and /c/ — the
 *    catalog and category pages, which are the moat (per §1).
 *
 * Bot user-agent lists live in src/lib/bot-policy.ts (shared with
 * src/proxy.ts per ARCHITECTURE.md §13.16). Bad actors ignore
 * robots.txt; defending against them is proxy.ts's job.
 *
 * Single source of truth — public/robots.txt is deleted; this file
 * generates /robots.txt at request time via Next.js App Router.
 */

// Block list applied to every audience — internal routes, never crawled.
const INTERNAL_DISALLOW = ['/api/', '/_next/', '/admin/'];

// What unidentified crawlers are restricted from.
// They get the homepage, blog, trends, about — enough to know we exist.
// They do NOT get the catalog or category pages.
const CATALOG_DISALLOW = ['/p/', '/c/', '/category/', '/products', '/search'];

export default function robots(): MetadataRoute.Robots {
  const allowedAudiences = [
    ...ALLOWED_SEARCH_ENGINES,
    ...ALLOWED_AI_CITATION_BOTS,
  ];

  return {
    rules: [
      // Whitelisted bots — full access except internal routes.
      ...allowedAudiences.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: INTERNAL_DISALLOW,
      })),
      // Default — restrict catalog access for everyone else.
      // They can see the homepage, about, blog, trends, etc.
      {
        userAgent: '*',
        allow: '/',
        disallow: [...INTERNAL_DISALLOW, ...CATALOG_DISALLOW],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
