import { Metadata } from "next";
import Link from "next/link";
import { getAllProducts } from "@/lib/data";

export const dynamic = "force-dynamic";


export const metadata: Metadata = {
  title: "All Brands - Canadian Electronics Price Tracker",
  description: "Browse all electronics brands tracked by TrackAura. Compare prices across Canadian retailers for ASUS, Corsair, Logitech, Samsung, and more.",
  alternates: { canonical: "https://www.trackaura.com/brands" },
};

function extractBrand(name: string): string {
  return name.split(/\s+/)[0]?.toUpperCase() || "";
}

function brandSlug(brand: string): string {
  return brand.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default async function BrandsPage() {
  const products = await getAllProducts();
  const brandCounts: Record<string, number> = {};
  const brandMinPrice: Record<string, number> = {};

  for (const p of products) {
    const brand = extractBrand(p.name);
    if (brand.length < 2) continue;
    brandCounts[brand] = (brandCounts[brand] || 0) + 1;
    if (!brandMinPrice[brand] || p.currentPrice < brandMinPrice[brand]) {
      brandMinPrice[brand] = p.currentPrice;
    }
  }

  const brands = Object.entries(brandCounts)
    .filter(([_, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <h1 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: "1.75rem", marginBottom: "0.5rem" }}>
        All <span className="gradient-text">Brands</span>
      </h1>
      <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "2rem" }}>
        {brands.length + " brands tracked across Canadian retailers."}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.75rem" }}>
        {brands.map(([brand, count]) => (
          <Link
            key={brand}
            href={"/brand/" + brandSlug(brand)}
            className="card"
            style={{ padding: "1rem", textDecoration: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <div>
              <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)" }}>
                {brand}
              </p>
              <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 2 }}>
                {count + " products"}
              </p>
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--accent)" }}>
              {"from $" + (brandMinPrice[brand] || 0).toFixed(0)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
