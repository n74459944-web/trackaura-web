import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductsByCategory, getStats, getPriceIndex } from "@/lib/data";
import {
  getCategorySnapshot,
  type BrandStat,
  type CategoryStats,
} from "@/lib/snapshots";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/types";
import type { Product } from "@/types";
import CategoryPageClient from "./CategoryPageClient";
import fs from "fs";
import path from "path";

export const revalidate = 14400;

type PageProps = { params: Promise<{ slug: string }> };

// Build all category routes at build time
export async function generateStaticParams() {
  const stats = await getStats();
  return stats.categories
    .filter((c: string) => c !== "other")
    .map((c: string) => ({ slug: c }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const label = CATEGORY_LABELS[slug];
  if (!label) return { title: "Category Not Found" };

  // Prefer snapshot; fall back to DB.
  const snapshot = getCategorySnapshot(slug);
  let topBrands: string;
  let count: number;

  if (snapshot) {
    topBrands = snapshot.brandStats.slice(0, 6).map((b) => b.name).join(", ");
    count = snapshot.catStats.totalProducts;
  } else {
    const products = await getProductsByCategory(slug);
    const brands = [...new Set(products.map((p) => p.brand).filter(Boolean))];
    topBrands = brands.slice(0, 6).join(", ");
    count = products.length;
  }

  return {
    title: `${label} — Compare Prices Across Canadian Retailers`,
    description: `Track ${count.toLocaleString()} ${label.toLowerCase()} from ${topBrands} and more. Price history, deals, and cross-retailer comparisons updated every 4 hours.`,
    alternates: { canonical: `https://www.trackaura.com/category/${slug}` },
    openGraph: {
      title: `${label} Price Tracker`,
      description: `${count.toLocaleString()} ${label.toLowerCase()} tracked across Canada Computers and Newegg.`,
      url: `https://www.trackaura.com/category/${slug}`,
    },
  };
}

// Related categories for the sidebar
const RELATED_CATEGORIES: Record<string, string[]> = {
  gpus: ["cpus", "power-supplies", "monitors", "cases", "motherboards"],
  cpus: ["gpus", "motherboards", "coolers", "ram"],
  monitors: ["gpus", "keyboards", "mice", "webcams"],
  ssds: ["ram", "motherboards", "external-storage", "cases"],
  ram: ["cpus", "motherboards", "ssds"],
  keyboards: ["mice", "monitors", "headphones"],
  mice: ["keyboards", "monitors", "headphones"],
  laptops: ["monitors", "keyboards", "mice", "external-storage", "headphones"],
  motherboards: ["cpus", "ram", "ssds", "gpus", "cases"],
  "power-supplies": ["gpus", "cases", "motherboards"],
  cases: ["power-supplies", "motherboards", "coolers", "gpus"],
  coolers: ["cpus", "motherboards", "cases"],
  headphones: ["speakers", "webcams", "keyboards"],
  speakers: ["headphones", "monitors"],
  routers: ["webcams", "external-storage"],
  webcams: ["monitors", "headphones", "routers"],
  "external-storage": ["ssds", "laptops"],
  "hard-drives": ["ssds", "external-storage", "nas"],
  tvs: ["monitors", "speakers", "gaming-consoles"],
  tablets: ["laptops", "keyboards", "headphones"],
  printers: ["monitors", "external-storage"],
  "gaming-consoles": ["controllers", "tvs", "headphones", "keyboards", "mice"],
  "smart-home": ["routers", "speakers"],
  "ups-power": ["power-supplies", "desktops"],
  "network-switches": ["routers"],
  "case-fans": ["coolers", "cases"],
  "desktops": ["monitors", "keyboards", "mice"],
  "nas": ["hard-drives", "ssds", "external-storage"],
  "accessories": ["keyboards", "mice", "headphones", "cases"],
  "controllers": ["gaming-consoles", "headphones", "keyboards"],
};

// ── Price changes for this category ──
interface PriceChange {
  id: number;
  name: string;
  slug: string;
  retailer: string;
  category: string;
  oldPrice: number;
  newPrice: number;
  direction: string;
  changedAt: string;
  pctChange?: number;
}

function getRecentChanges(category: string): PriceChange[] {
  try {
    const changesPath = path.join(process.cwd(), "public", "data", "changes.json");
    const raw = fs.readFileSync(changesPath, "utf-8");
    const all = JSON.parse(raw) as PriceChange[];
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    return all
      .filter(
        (c) =>
          c.category === category &&
          new Date(c.changedAt).getTime() > threeDaysAgo
      )
      .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
      .slice(0, 20);
  } catch {
    return [];
  }
}

// ── DB-fallback computations (only used when snapshot missing) ──

function computeBrandStats(products: Product[]): BrandStat[] {
  const map: Record<string, { count: number; totalPrice: number; minPrice: number; deals: number }> = {};

  for (const p of products) {
    const brand = p.brand || "Unknown";
    if (!map[brand]) {
      map[brand] = { count: 0, totalPrice: 0, minPrice: Infinity, deals: 0 };
    }
    map[brand].count++;
    map[brand].totalPrice += p.currentPrice;
    if (p.currentPrice < map[brand].minPrice) map[brand].minPrice = p.currentPrice;
    if (p.minPrice < p.maxPrice && p.currentPrice <= p.minPrice) {
      map[brand].deals++;
    }
  }

  return Object.entries(map)
    .filter(([name]) => {
      if (name === "Unknown") return false;
      if (name.length < 2) return false;
      if (/^\(\d+\)$/.test(name)) return false;
      if (/^\d+$/.test(name)) return false;
      if (name.includes(",")) return false;
      if (/^[^a-zA-Z]*$/.test(name)) return false;
      return true;
    })
    .filter(([, s]) => s.count >= 5)
    .map(([name, s]) => ({
      name,
      count: s.count,
      avgPrice: Math.round(s.totalPrice / s.count),
      minPrice: s.minPrice,
      deals: s.deals,
    }))
    .sort((a, b) => b.count - a.count);
}

function computeCategoryStats(products: Product[]): CategoryStats {
  const prices = products.map((p) => p.currentPrice).sort((a, b) => a - b);
  const median = prices.length > 0 ? prices[Math.floor(prices.length / 2)] : 0;
  const avg = prices.length > 0 ? Math.round(prices.reduce((s, p) => s + p, 0) / prices.length) : 0;
  const atLowest = products.filter((p) => p.currentPrice <= p.minPrice && p.priceCount > 1).length;
  const withHistory = products.filter((p) => p.priceCount >= 3).length;

  const retailerMap: Record<string, number> = {};
  for (const p of products) {
    retailerMap[p.retailer] = (retailerMap[p.retailer] || 0) + 1;
  }
  const retailers = Object.entries(retailerMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return { totalProducts: products.length, avgPrice: avg, medianPrice: median, atLowest, withHistory, retailers };
}

// ── Trend banner helper ──
// Reads the generated price-index.json and returns a pctChange if the
// category has enough history to make a monthly claim. Noise guards:
//   - at least 14 days of trend data (otherwise "this month" is a lie)
//   - at least 0.5% absolute change (otherwise the banner is clutter)
// Returns null when the banner should not render.
async function getCategoryTrendSignal(slug: string): Promise<{ pct: number } | null> {
  try {
    const priceIndex = await getPriceIndex();
    const cat = priceIndex?.categories?.[slug];
    if (!cat || !Array.isArray(cat.trend) || cat.trend.length < 14) return null;
    const pct = cat.pctChange;
    if (typeof pct !== "number" || Math.abs(pct) < 0.5) return null;
    return { pct };
  } catch {
    return null;
  }
}

// ── Page ──

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const label = CATEGORY_LABELS[slug];
  if (!label) notFound();

  // Snapshot-first; fall back to DB if missing.
  const snapshot = getCategorySnapshot(slug);

  let products: Product[];
  let brandStats: BrandStat[];
  let catStats: CategoryStats;

  if (snapshot) {
    products = snapshot.products;
    brandStats = snapshot.brandStats;
    catStats = snapshot.catStats;
  } else {
    products = await getProductsByCategory(slug);
    if (products.length === 0) notFound();
    brandStats = computeBrandStats(products);
    catStats = computeCategoryStats(products);
  }

  if (products.length === 0) notFound();

  const icon = CATEGORY_ICONS[slug] || "📦";
  const recentChanges = getRecentChanges(slug);
  const relatedCats = (RELATED_CATEGORIES[slug] || []).filter(
    (c) => CATEGORY_LABELS[c]
  );
  const trendSignal = await getCategoryTrendSignal(slug);

  // Structured data
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${label} — TrackAura`,
      description: `Browse ${products.length} ${label.toLowerCase()} tracked across Canadian retailers.`,
      url: `https://www.trackaura.com/category/${slug}`,
      publisher: {
        "@type": "Organization",
        name: "TrackAura",
        url: "https://www.trackaura.com",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://www.trackaura.com" },
        { "@type": "ListItem", position: 2, name: "Categories", item: "https://www.trackaura.com/categories" },
        { "@type": "ListItem", position: 3, name: label },
      ],
    },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Breadcrumb */}
      <nav
        style={{
          display: "flex",
          gap: "0.5rem",
          fontSize: "0.8125rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <Link href="/" className="accent-link">Home</Link>
        <span style={{ color: "var(--text-secondary)" }}>/</span>
        <Link href="/categories" className="accent-link">Categories</Link>
        <span style={{ color: "var(--text-secondary)" }}>/</span>
        <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      </nav>

      {/* Category header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <span style={{ fontSize: "2rem" }}>{icon}</span>
          <h1
            style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 800,
              fontSize: "1.75rem",
              lineHeight: 1.2,
            }}
          >
            {label}
          </h1>
        </div>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "0.9375rem",
            lineHeight: 1.6,
            maxWidth: 700,
          }}
        >
          {`Tracking ${catStats.totalProducts.toLocaleString()} ${label.toLowerCase()} across ${catStats.retailers.map((r) => r.name).join(", ")}. Average price: $${catStats.avgPrice.toLocaleString()} CAD.`}
          {catStats.atLowest > 0 &&
            ` ${catStats.atLowest} product${catStats.atLowest > 1 ? "s" : ""} currently at their lowest tracked price.`}
        </p>
      </div>

      {/* Quick stats bar */}
      <div
        className="card"
        style={{
          display: "flex",
          gap: "1.5rem",
          padding: "1rem 1.5rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          fontSize: "0.8125rem",
        }}
      >
        <div>
          <span style={{ color: "var(--text-secondary)" }}>Products</span>
          <p style={{ fontWeight: 700, fontFamily: "'Sora', sans-serif" }}>
            {catStats.totalProducts.toLocaleString()}
          </p>
        </div>
        <div>
          <span style={{ color: "var(--text-secondary)" }}>Brands</span>
          <p style={{ fontWeight: 700, fontFamily: "'Sora', sans-serif" }}>
            {brandStats.length}
          </p>
        </div>
        <div>
          <span style={{ color: "var(--text-secondary)" }}>Avg Price</span>
          <p style={{ fontWeight: 700, fontFamily: "'Sora', sans-serif" }}>
            ${catStats.avgPrice.toLocaleString()}
          </p>
        </div>
        <div>
          <span style={{ color: "var(--text-secondary)" }}>Median</span>
          <p style={{ fontWeight: 700, fontFamily: "'Sora', sans-serif" }}>
            ${catStats.medianPrice.toLocaleString()}
          </p>
        </div>
        <div>
          <span style={{ color: "var(--text-secondary)" }}>At Lowest</span>
          <p style={{ fontWeight: 700, fontFamily: "'Sora', sans-serif", color: "var(--accent)" }}>
            {catStats.atLowest}
          </p>
        </div>
        {catStats.retailers.map((r) => (
          <div key={r.name}>
            <span style={{ color: "var(--text-secondary)" }}>{r.name}</span>
            <p style={{ fontWeight: 700, fontFamily: "'Sora', sans-serif" }}>
              {r.count.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Trend signal banner — cross-links to /trends when the category has
          meaningful monthly movement. Silently hides for categories with
          thin history or near-flat trends (see getCategoryTrendSignal above). */}
      {trendSignal && (
        <Link
          href="/trends"
          aria-label={`${label} are ${trendSignal.pct < 0 ? "down" : "up"} ${Math.abs(trendSignal.pct).toFixed(1)} percent this month. See all category trends.`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.625rem 1rem",
            marginBottom: "1.5rem",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--card-bg, rgba(255,255,255,0.03))",
            fontSize: "0.8125rem",
            textDecoration: "none",
            color: "var(--text-primary)",
          }}
        >
          <span
            style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 700,
              fontSize: "0.875rem",
              color: trendSignal.pct < 0 ? "var(--accent)" : "var(--danger, #ff6b6b)",
              whiteSpace: "nowrap",
            }}
          >
            {`${trendSignal.pct < 0 ? "↓" : "↑"} ${Math.abs(trendSignal.pct).toFixed(1)}%`}
          </span>
          <span style={{ flex: 1, color: "var(--text-secondary)" }}>
            {`${label} this month`}
          </span>
          <span style={{ color: "var(--accent)", fontWeight: 600, whiteSpace: "nowrap" }}>
            See all trends →
          </span>
        </Link>
      )}

      {/* Client component handles tabs, filtering, sorting, brand drill-down */}
      <CategoryPageClient
        slug={slug}
        label={label}
        icon={icon}
        products={products}
        brandStats={brandStats}
        recentChanges={recentChanges}
        relatedCats={relatedCats}
        catStats={catStats}
      />

      {/* SEO content block */}
      <div
        style={{
          fontSize: "0.9375rem",
          color: "var(--text-secondary)",
          lineHeight: 1.8,
          marginTop: "2rem",
          marginBottom: "2rem",
        }}
      >
        <h2
          style={{
            fontFamily: "'Sora', sans-serif",
            fontWeight: 700,
            fontSize: "1.125rem",
            color: "var(--text-primary)",
            marginBottom: "0.75rem",
          }}
        >
          {`${label} Prices in Canada`}
        </h2>
        <p style={{ marginBottom: "1rem" }}>
          {`TrackAura monitors ${label.toLowerCase()} prices from ${catStats.retailers.map((r) => r.name).join(" and ")} every 4 hours. We track ${brandStats.length} brands including ${brandStats.slice(0, 5).map((b) => b.name).join(", ")}${brandStats.length > 5 ? " and more" : ""}. Each product page shows a full price history chart so you can tell if a sale is real.`}
        </p>
        <p>
          {"Looking for the best deal? Check our "}
          <Link href={`/best/${slug}`} className="accent-link">
            {`${label} buying guide`}
          </Link>
          {" for data-driven recommendations, or use the filters above to find products at their lowest tracked price."}
        </p>
      </div>

      {/* Related categories */}
      {relatedCats.length > 0 && (
        <div className="card" style={{ padding: "1.25rem 1.5rem", marginBottom: "1.5rem" }}>
          <h2
            style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 600,
              fontSize: "0.9375rem",
              marginBottom: "0.75rem",
            }}
          >
            Related Categories
          </h2>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {relatedCats.map((cat) => (
              <Link
                key={cat}
                href={`/category/${cat}`}
                className="filter-pill"
                style={{
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.375rem",
                }}
              >
                <span>{CATEGORY_ICONS[cat] || "📦"}</span>
                <span>{CATEGORY_LABELS[cat] || cat}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          padding: "1rem",
          fontSize: "0.75rem",
          color: "var(--text-secondary)",
          textAlign: "center",
          lineHeight: 1.6,
        }}
      >
        Prices in Canadian dollars (CAD), updated every 4 hours. Some links may earn TrackAura a commission.
      </div>
    </div>
  );
}
