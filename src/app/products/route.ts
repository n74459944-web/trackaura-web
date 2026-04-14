import { NextResponse } from "next/server";
import { getAllProducts } from "@/lib/data";

// Cache at the edge for 4 hours (matches scrape cycle).
// s-maxage tells Vercel's CDN to cache; stale-while-revalidate lets
// the next request trigger a background refresh so users never wait.
export const revalidate = 14400;

export async function GET() {
  try {
    const products = await getAllProducts();
    return NextResponse.json(products, {
      headers: {
        "Cache-Control": "public, s-maxage=14400, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("GET /api/products failed:", err);
    return NextResponse.json(
      { error: "Failed to load products" },
      { status: 500 },
    );
  }
}
