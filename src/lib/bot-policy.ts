/**
 * Bot user-agent policy — single source of truth.
 *
 * Imported by:
 *   - src/app/robots.ts — declarative policy, generates /robots.txt
 *   - src/proxy.ts      — runtime enforcement at the edge (403 on block)
 *
 * Rule per ARCHITECTURE.md §13.16: when two files claim to define the
 * same thing, one is wrong by definition. Pick one. Delete the other.
 *
 * History: prior to 2026-04-26, robots.ts declared GPTBot/ClaudeBot/
 * PerplexityBot/etc. as allowed AI citation crawlers, while proxy.ts
 * silently 403'd them at the edge. The §11 LLM-citation work was
 * functionally nullified for the duration. Reconciled by extracting
 * here.
 *
 * Substring matching: proxy.ts uses case-insensitive substring matching
 * against the lowercased UA. Be careful with names that prefix others
 * (e.g. "Applebot" is allowed but "Applebot-Extended" is blocked — the
 * block check on "applebot-extended" is correctly more specific than
 * the allow check on "applebot").
 */

// ───────────────────────── Allowed ─────────────────────────

/**
 * Search engines we want crawling — drive Phase 0 organic SEO.
 */
export const ALLOWED_SEARCH_ENGINES = [
  'Googlebot',
  'Bingbot',
  'Slurp',           // Yahoo
  'DuckDuckBot',
  'YandexBot',
  'Baiduspider',
];

/**
 * AI citation crawlers — they bring users via citations in
 * ChatGPT / Claude / Perplexity / Apple Intelligence answers.
 * Currently driving ~5% of active users (per ARCHITECTURE.md §11
 * LLM citation optimization).
 */
export const ALLOWED_AI_CITATION_BOTS = [
  'GPTBot',          // OpenAI training crawler
  'ChatGPT-User',    // ChatGPT live browsing on user request
  'OAI-SearchBot',   // OpenAI search index
  'ClaudeBot',       // Anthropic training crawler
  'Claude-Web',      // Anthropic live browsing
  'anthropic-ai',    // Anthropic alternate UA
  'PerplexityBot',   // Perplexity index
  'Perplexity-User', // Perplexity live browsing
  'Applebot',        // Apple Intelligence / Siri (Applebot-Extended is blocked)
  'Google-Extended', // Google AI training (Gemini); separate from Googlebot
];

export const ALLOWED_BOTS = [
  ...ALLOWED_SEARCH_ENGINES,
  ...ALLOWED_AI_CITATION_BOTS,
];

// ───────────────────────── Blocked ─────────────────────────

/**
 * AI scrapers we don't want — no measurable user-driving value, or
 * known to ignore robots.txt and scrape aggressively.
 */
export const BLOCKED_AI_SCRAPERS = [
  'CCBot',                // Common Crawl
  'amazonbot',
  'Bytespider',           // ByteDance / TikTok
  'FacebookBot',
  'meta-externalagent',   // Meta AI / Llama crawler
  'Applebot-Extended',    // distinct from Applebot — opt-out for AI training
  'cohere-ai',
  'Diffbot',
  'ImagesiftBot',
  'omgili',
  'omgilibot',
];

/**
 * SEO tool scrapers — high request volume, zero traffic in return.
 */
export const BLOCKED_SEO_SCRAPERS = [
  'AhrefsBot',
  'SemrushBot',
  'MJ12bot',
  'DotBot',
  'DataForSeoBot',
  'BLEXBot',
  'PetalBot',
  'SeekportBot',
  'ZoomInfoBot',
  'TimpiBot',
  'VelenPublicWebCrawler',
];

/**
 * Generic HTTP clients — almost always scripts, almost never users.
 * Trade-off: any legitimate browser-shaped UA still works; only the
 * default tool UAs are caught.
 */
export const BLOCKED_GENERIC_SCRAPERS = [
  'Scrapy',
  'python-requests',
  'python-urllib',
  'Go-http-client',
  'node-fetch',
  'axios/',
  'curl/',
  'Wget/',
  'libwww-perl',
  'Java/',
];

export const BLOCKED_BOTS = [
  ...BLOCKED_AI_SCRAPERS,
  ...BLOCKED_SEO_SCRAPERS,
  ...BLOCKED_GENERIC_SCRAPERS,
];

// ───────────────────────── Helpers ─────────────────────────

/**
 * Case-insensitive substring check against the blocked list.
 * Used by proxy.ts for edge-time enforcement.
 */
export function isBlockedUserAgent(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return BLOCKED_BOTS.some((bot) => ua.includes(bot.toLowerCase()));
}
