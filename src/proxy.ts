import { NextRequest, NextResponse } from "next/server";

// ========================================
// Bot user-agent patterns — blocked at edge
// These return 403 immediately without invoking any page function,
// which is the cheapest possible way to reject a request on Vercel.
// ========================================
const BLOCKED_BOTS = [
  // AI scrapers
  "gptbot",
  "chatgpt-user",
  "oai-searchbot",
  "claudebot",
  "claude-web",
  "anthropic-ai",
  "perplexitybot",
  "perplexity-user",
  "ccbot",
  "amazonbot",
  "bytespider",
  "google-extended",
  "facebookbot",
  "meta-externalagent",
  "applebot-extended",
  "cohere-ai",
  "diffbot",
  "imagesiftbot",
  "omgili",
  "omgilibot",
  // SEO tool scrapers (aggressive, no value to us)
  "ahrefsbot",
  "semrushbot",
  "mj12bot",
  "dotbot",
  "dataforseobot",
  "blexbot",
  "petalbot",
  "seekportbot",
  "zoominfobot",
  "timpibot",
  "velenpublicwebcrawler",
  // Generic scrapers
  "scrapy",
  "python-requests",
  "python-urllib",
  "go-http-client",
  "node-fetch",
  "axios/",
  "curl/",
  "wget/",
  "libwww-perl",
  "java/",
];

export function proxy(request: NextRequest) {
  // ========================================
  // Kill switch — flip MAINTENANCE_MODE=1 in Vercel env vars
  // to instantly serve a maintenance page without redeploying.
  // Useful if costs spike again or a bug is discovered in production.
  // ========================================
  if (process.env.MAINTENANCE_MODE === "1") {
    const pathname = request.nextUrl.pathname;
    // Allow static assets and the maintenance page itself through
    if (
      pathname.startsWith("/_next/") ||
      pathname.startsWith("/favicon") ||
      pathname === "/robots.txt"
    ) {
      return NextResponse.next();
    }
    return new NextResponse(
      "<!DOCTYPE html><html><head><title>TrackAura - Maintenance</title><meta name='viewport' content='width=device-width,initial-scale=1'><style>body{font-family:system-ui,sans-serif;background:#0a0a0a;color:#e5e5e5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:2rem}h1{font-size:1.5rem;margin-bottom:1rem}p{color:#999;max-width:500px}</style></head><body><div><h1>TrackAura is briefly offline</h1><p>We're performing maintenance. Please check back shortly.</p></div></body></html>",
      {
        status: 503,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Retry-After": "3600",
          "Cache-Control": "no-store",
        },
      }
    );
  }

  // ========================================
  // Bot blocking — check user agent against blocklist
  // ========================================
  const userAgent = (request.headers.get("user-agent") || "").toLowerCase();

  // Empty user agent is almost always a bot or script
  if (!userAgent || userAgent.length < 10) {
    return new NextResponse("Forbidden", {
      status: 403,
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  }

  for (const bot of BLOCKED_BOTS) {
    if (userAgent.includes(bot)) {
      return new NextResponse("Forbidden: automated access not permitted", {
        status: 403,
        headers: {
          "Cache-Control": "public, max-age=86400",
          "X-Robots-Tag": "noindex",
        },
      });
    }
  }

  return NextResponse.next();
}

// ========================================
// Matcher — run proxy on all routes except static assets
// Static files don't need bot filtering (they're cached at the edge anyway)
// and excluding them saves on proxy invocations.
// ========================================
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2)$).*)",
  ],
};
