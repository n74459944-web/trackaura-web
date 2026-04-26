import type { MetadataRoute } from 'next';

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
 * Bad actors ignore robots.txt; defending against them is an
 * infrastructure concern (rate limiting, bot filtering at the
 * edge), not a robots.txt concern. So we don't enumerate "bad"
 * bots here — anyone unrecognized falls through to the default
 * restrictive policy.
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

// Search engines that drive SEO — keep them happy.
const SEARCH_ENGINES = [
  'Googlebot',
  'Bingbot',
  'Slurp',           // Yahoo
  'DuckDuckBot',
  'YandexBot',
  'Baiduspider',
];

// AI citation crawlers — they drive measurable traffic via answers
// citing TrackAura. Allowed for the same reason search engines are:
// they bring users.
const AI_CITATION_BOTS = [
  'GPTBot',          // OpenAI training crawler
  'ChatGPT-User',    // ChatGPT live browsing on user request
  'OAI-SearchBot',   // OpenAI search index
  'ClaudeBot',       // Anthropic training crawler
  'Claude-Web',      // Anthropic live browsing
  'anthropic-ai',    // Anthropic alternate UA
  'PerplexityBot',   // Perplexity index
  'Perplexity-User', // Perplexity live browsing
  'Applebot',        // Apple Intelligence / Siri
  'Google-Extended', // Google AI training (Gemini); separate from Googlebot
];

export default function robots(): MetadataRoute.Robots {
  const allowedAudiences = [...SEARCH_ENGINES, ...AI_CITATION_BOTS];

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
