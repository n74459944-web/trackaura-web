import { Suspense } from "react";
import { Metadata } from "next";
import { getAllProducts } from "@/lib/data";
import DealsClient from "./DealsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Best Electronics Deals in Canada",
  description:
    "Find the best electronics deals across Canadian retailers. Track price drops on GPUs, headphones, SSDs, monitors, keyboards, mice, and laptops at Canada Computers and Newegg Canada.",
  alternates: {
    canonical: "https://www.trackaura.com/deals",
  },
};

export default function DealsPage() {
  const allProducts = getAllProducts().filter((p) => p.category !== "other");

  // Only pass actual deals to the client (products with a price drop)
  // This prevents serializing 18,000+ products into the HTML
  const deals = allProducts
    .filter((p) => p.minPrice < p.maxPrice && p.currentPrice < p.maxPrice)
    .sort((a, b) => {
      const aDiscount = (a.maxPrice - a.currentPrice) / a.maxPrice;
      const bDiscount = (b.maxPrice - b.currentPrice) / b.maxPrice;
      return bDiscount - aDiscount;
    })
    .slice(0, 500);

  return (
    <Suspense
      fallback={
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "4rem 1.5rem", textAlign: "center", color: "var(--text-secondary)" }}>
          Loading deals...
        </div>
      }
    >
      <DealsClient initialProducts={deals} />
    </Suspense>
  );
}
