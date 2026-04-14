import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/lib/data";

// Short server cache — searches are query-specific so caching is per-URL
export const revalidate = 300; // 5 minutes

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  if (q.trim().length < 2) {
    return NextResponse.json([]);
  }

  try {
    const results = await searchProducts(q);
    return NextResponse.json(results, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    console.error("GET /api/search failed:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
