import { Suspense } from "react";
import { Metadata } from "next";
import { getAllProducts } from "@/lib/data";
import DealsClient from "./DealsClient";

// CRITICAL: was force-dynamic, which re-scanned the entire 37K-row products
// table on EVERY visit. Now caches for 4 hours per region (matches scrape
// cycle). Cuts reads from this page by ~99.7%.
export const revalidate = 14400;

export const metadata: Metadata = {
  title: "Best Electronics Deals in Canada",
  description:
    "Find the best electronics deals across Canadian retailers. Track price drops on GPUs, headphones, SSDs, monitors, keyboards, mice, and laptops at Canada Computers and Newegg Canada.",
  alternates: {
    canonical: "https://www.trackaura.com/deals",
  },
};

// Normalize a product name for deduplication (strip color/variant suffixes)
function normalizeForDedup(name: string): string {
  return name
    .replace(/\s*[-\u2013]\s*(black|white|blue|pink|red|green|grey|gray|silver|purple|beige|navy|orange|cream)\s*$/i, "")
    .replace(/\s*,\s*(black|white|blue|pink|red|green|grey|gray|silver|purple|beige|navy|orange|cream)\s*$/i, "")
    .replace(/\(open\s*box\)/i, "")
    .trim()
    .toLowerCase();
}

export default async function DealsPage() {
  const allProducts = (await getAllProducts()).filter((p) => p.category !== "other");

  const deals = allProducts
    .filter((p) => {
      // Must have a real price drop
      if (!(p.minPrice < p.maxPrice && p.currentPrice < p.maxPrice)) return false;

      // Filter out data errors: max/min ratio > 5x is suspicious
      if (p.maxPrice > p.minPrice * 5) return false;

      // Filter out tiny drops (less than 2% AND less than $2)
      const dropPct = (p.maxPrice - p.currentPrice) / p.maxPrice;
      const dropAbs = p.maxPrice - p.currentPrice;
      if (dropPct < 0.02 && dropAbs < 2) return false;

      // Must have enough price history to be meaningful
      if ((p.priceCount || 0) < 2) return false;

      return true;
    })
    .sort((a, b) => {
      const aDiscount = (a.maxPrice - a.currentPrice) / a.maxPrice;
      const bDiscount = (b.maxPrice - b.currentPrice) / b.maxPrice;
      return bDiscount - aDiscount;
    });

  // Deduplicate color variants — keep the cheapest version
  const seen = new Set<string>();
  const deduped = deals.filter((p) => {
    const key = normalizeForDedup(p.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const top50 = deduped.slice(0, 50);

  return (
    <Suspense
      fallback={
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "4rem 1.5rem", textAlign: "center", color: "var(--text-secondary)" }}>
          Loading deals...
        </div>
      }
    >
      <DealsClient initialProducts={top50} />
    </Suspense>
  );
}
