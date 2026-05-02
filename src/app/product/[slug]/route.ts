/**
 * Legacy /product/[slug] route handler.
 *
 * Background: A slug regen sometime around 2026-04-17 created ~3,000 dead
 * /product/[slug] URLs that Google had cached. Those URLs no longer match
 * any row in canonical_products, but the *products themselves* mostly still
 * exist under different (longer, brand-prefixed) slugs.
 *
 * Strategy:
 *   - Exact slug match in canonical_products → 301 redirect to /p/[slug]
 *     (catches the small fraction where the old slug happens to still match)
 *   - No match → 410 Gone with a friendly HTML body
 *     (tells Google these URLs are permanently deleted, removes from index
 *      faster than 404 and frees up crawl budget)
 *
 * Why a route.ts and not a page.tsx: this returns HTTP responses, not React
 * components. Static handler is simpler and faster than rendering a page
 * just to redirect.
 *
 * Notes:
 *   - 301 (permanent) tells Google "update your index"; this is a one-time
 *     thing, the legacy /product/ path will never be a real route again.
 *   - 410 (Gone) is preferred over 404 for permanently removed URLs because
 *     Google removes 410s from the index in days/weeks vs months for 404s.
 *   - If `canonical_products` is eventually retired in favor of
 *     `canonical_entities`, this handler stays correct: anything not in the
 *     legacy table just 410s, which is the right behavior.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!slug || typeof slug !== "string") {
    return goneResponse();
  }

  // Decode in case Google has URL-encoded slugs.
  let decodedSlug: string;
  try {
    decodedSlug = decodeURIComponent(slug);
  } catch {
    return goneResponse();
  }

  // Look up the slug in canonical_products. If it exists, redirect.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("canonical_products")
    .select("slug")
    .eq("slug", decodedSlug)
    .limit(1)
    .maybeSingle();

  if (error) {
    // Don't 500 on a Supabase blip — better to 410 and let Google retry later.
    // Log for observability but treat as "not found" from the client's view.
    console.error("[/product/[slug]] supabase error:", error.message);
    return goneResponse();
  }

  if (data?.slug) {
    // 301 to the canonical /p/[slug] route.
    const dest = new URL(`/p/${data.slug}`, _request.nextUrl.origin);
    return NextResponse.redirect(dest, 301);
  }

  return goneResponse();
}

function goneResponse(): Response {
  const body = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Page removed — TrackAura</title>
  <meta name="robots" content="noindex">
  <style>
    body { font-family: system-ui, sans-serif; max-width: 540px; margin: 80px auto; padding: 0 20px; color: #e6e6e6; background: #0a0a0a; }
    h1 { font-size: 24px; margin: 0 0 16px; }
    p { line-height: 1.6; color: #999; }
    a { color: #4ade80; }
  </style>
</head>
<body>
  <h1>This page is no longer available</h1>
  <p>This product URL was part of an older catalog format and has been retired. The product may still exist under a different URL.</p>
  <p><a href="/">Browse current products</a></p>
</body>
</html>`;

  return new Response(body, {
    status: 410,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
