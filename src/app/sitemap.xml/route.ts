import { NextResponse } from "next/server";
import { getAllProducts } from "@/lib/data";

// Cache the sitemap index for 24 hours.
// The index is tiny (~1 KB) and only needs to change when the number
// of product chunks changes (i.e. when product count crosses a 1000 boundary).
export const revalidate = 86400;

const BASE_URL = "https://www.trackaura.com";
const PRODUCTS_PER_SITEMAP = 1000;

export async function GET() {
  const products = await getAllProducts();
  const productChunkCount = Math.ceil(products.length / PRODUCTS_PER_SITEMAP);

  // Build list of child sitemap URLs.
  // Static sitemap holds all non-product pages (home, categories, brands, blog, etc).
  // Each products-N sitemap holds up to 1000 product pages.
  const childSitemaps: string[] = [`${BASE_URL}/sitemaps/static.xml`];
  for (let i = 0; i < productChunkCount; i++) {
    childSitemaps.push(`${BASE_URL}/sitemaps/products-${i}.xml`);
  }

  const today = new Date().toISOString().split("T")[0];

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    childSitemaps
      .map(
        (loc) =>
          `  <sitemap>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`
      )
      .join("\n") +
    "\n</sitemapindex>\n";

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Aggressive caching — sitemap index rarely changes
      "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=172800",
    },
  });
}
