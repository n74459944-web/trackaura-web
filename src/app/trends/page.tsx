import { Metadata } from "next";
import Link from "next/link";
import { getAllProducts, getPriceIndex } from "@/lib/data";
import { formatPrice } from "@/lib/utils";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/types";
import PriceIndexChart from "@/components/PriceIndexChart";

export const metadata: Metadata = {
  title: "Canadian Electronics Price Trends — TrackAura Price Index",
  description:
    "Track how electronics prices are moving across Canada. Real-time price index across GPUs, CPUs, RAM, monitors, and more from Canadian retailers.",
  alternates: { canonical: "https://www.trackaura.com/trends" },
};

export default function TrendsPage() {
  const allProducts = getAllProducts();
  const priceIndex = getPriceIndex();
  const month = new Date().toLocaleString("en-CA", { month: "long" });
  const year = new Date().getFullYear();

  // Build category stats
  const categoryStats = Object.entries(CATEGORY_LABELS)
    .filter(([key]) => key !== "other")
    .map(([key, label]) => {
      const products = allProducts.filter((p) => p.category === key);
      if (products.length === 0) return null;

      const prices = products.map((p) => p.currentPrice);
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
      const median = [...prices].sort((a, b) => a - b)[Math.floor(prices.length / 2)];
      const lowest = Math.min(...prices);
      const highest = Math.max(...prices);

      const atLowest = products.filter(
        (p) => p.currentPrice <= p.minPrice && p.priceCount > 1
      ).length;
      const withDrops = products.filter(
        (p) => p.currentPrice < p.maxPrice && p.minPrice < p.maxPrice
      ).length;
      const dropPercent = products.length > 0 ? Math.round((withDrops / products.length) * 100) : 0;

      // Average % above historical low
      const productsWithHistory = products.filter((p) => p.minPrice > 0 && p.priceCount > 1);
      const avgAboveLow =
        productsWithHistory.length > 0
          ? productsWithHistory.reduce((sum, p) => {
              return sum + ((p.currentPrice - p.minPrice) / p.minPrice) * 100;
            }, 0) / productsWithHistory.length
          : 0;

      const icon = CATEGORY_ICONS[key] || "\uD83D\uDCE6";

      return {
        key,
        label,
        icon,
        count: products.length,
        avg,
        median,
        lowest,
        highest,
        atLowest,
        withDrops,
        dropPercent,
        avgAboveLow: isNaN(avgAboveLow) ? 0 : avgAboveLow,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b as any).count - (a as any).count) as any[];

  // Overall stats
  const totalProducts = allProducts.length;
  const allPrices = allProducts.map((p) => p.currentPrice);
  const overallAvg = allPrices.reduce((a, b) => a + b, 0) / allPrices.length;
  const totalAtLowest = allProducts.filter(
    (p) => p.currentPrice <= p.minPrice && p.priceCount > 1
  ).length;
  const totalWithDrops = allProducts.filter(
    (p) => p.currentPrice < p.maxPrice && p.minPrice < p.maxPrice
  ).length;

  // Overall avg above low
  const productsWithHistory = allProducts.filter((p) => p.minPrice > 0 && p.priceCount > 1);
  const overallAboveLow =
    productsWithHistory.length > 0
      ? productsWithHistory.reduce((sum, p) => {
          return sum + ((p.currentPrice - p.minPrice) / p.minPrice) * 100;
        }, 0) / productsWithHistory.length
      : 0;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Canadian Electronics Price Trends \u2014 " + month + " " + year,
    description: "Real-time electronics price index tracking " + totalProducts + " products across Canadian retailers.",
    dateModified: new Date().toISOString(),
    author: { "@type": "Organization", name: "TrackAura" },
    publisher: { "@type": "Organization", name: "TrackAura", url: "https://www.trackaura.com" },
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <nav style={{ display: "flex", gap: "0.5rem", fontSize: "0.8125rem", marginBottom: "1.5rem" }}>
        <Link href="/" className="accent-link">Home</Link>
        <span style={{ color: "var(--text-secondary)" }}>/</span>
        <span style={{ color: "var(--text-secondary)" }}>Price Trends</span>
      </nav>

      <h1 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: "1.75rem", marginBottom: "0.75rem" }}>
        {"\uD83D\uDCC8 Canadian Electronics Price Index"}
      </h1>
      <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem", lineHeight: 1.7, marginBottom: "2rem" }}>
        {"A real-time snapshot of electronics pricing across Canada, updated every 4 hours. " +
        "Tracking " + totalProducts.toLocaleString() + " products from Canada Computers and Newegg Canada."}
      </p>

      {/* Overall market summary */}
      <div className="card" style={{ padding: "1.5rem", marginBottom: "2rem" }}>
        <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: "1.125rem", marginBottom: "1rem" }}>
          {"Market Overview \u2014 " + month + " " + year}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "1rem" }}>
          <StatBox label="Products Tracked" value={totalProducts.toLocaleString()} />
          <StatBox label="Avg Price" value={formatPrice(overallAvg)} />
          <StatBox label="At Historical Low" value={totalAtLowest.toLocaleString()} accent />
          <StatBox label="Price Drops" value={totalWithDrops.toLocaleString()} />
          <StatBox
            label="Avg Above Low"
            value={overallAboveLow.toFixed(1) + "%"}
            accent={overallAboveLow < 5}
          />
        </div>
      </div>

      {/* Overall price trend chart */}
      {priceIndex && priceIndex.overall.length > 1 && (
        <div className="card" style={{ padding: "1.5rem", marginBottom: "2rem" }}>
          <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: "1.125rem", marginBottom: "0.5rem" }}>
            Overall Price Trend
          </h2>
          <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
            {"Average price across all " + totalProducts.toLocaleString() + " tracked products, updated every 4 hours."}
          </p>
          <PriceIndexChart data={priceIndex.overall} />
        </div>
      )}

      {/* SEO content */}
      <div style={{ marginBottom: "2rem", fontSize: "0.9375rem", color: "var(--text-secondary)", lineHeight: 1.8 }}>
        <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: "1.125rem", color: "var(--text-primary)", marginBottom: "0.75rem" }}>
          {"How Electronics Prices Are Moving in Canada"}
        </h2>
        <p style={{ marginBottom: "1rem" }}>
          {"As of " + month + " " + year + ", the average electronics price across all categories we track is " +
          formatPrice(overallAvg) + " CAD. Out of " + totalProducts.toLocaleString() + " products, " +
          totalAtLowest.toLocaleString() + " are currently sitting at the lowest price we\u2019ve ever recorded \u2014 " +
          "that\u2019s " + Math.round((totalAtLowest / totalProducts) * 100) + "% of all tracked products."}
        </p>
        {overallAboveLow > 0 && (
          <p style={{ marginBottom: "1rem" }}>
            {"On average, products are currently " + overallAboveLow.toFixed(1) + "% above their historical low. " +
            (overallAboveLow < 3
              ? "This suggests it\u2019s a good time to buy \u2014 most products are near their cheapest recorded prices."
              : overallAboveLow < 10
              ? "There\u2019s still some room for prices to drop in many categories."
              : "Prices are elevated in several categories \u2014 consider waiting for sales on big-ticket items.")}
          </p>
        )}
        {totalWithDrops > 0 && (
          <p style={{ marginBottom: "1rem" }}>
            {"We\u2019ve recorded price drops on " + totalWithDrops.toLocaleString() + " products since tracking began. " +
            (totalWithDrops > totalProducts * 0.3
              ? "The market has been quite active with frequent price changes across retailers."
              : "Prices have been relatively stable overall, which is typical for electronics in this period.")}
          </p>
        )}
      </div>

      {/* Category breakdown table */}
      <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: "1.125rem", marginBottom: "1rem" }}>
        Price Index by Category
      </h2>

      <div style={{ overflowX: "auto", marginBottom: "2rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border)" }}>
              <th style={{ ...thStyle, textAlign: "left" }}>Category</th>
              <th style={thStyle}>Products</th>
              <th style={thStyle}>Avg Price</th>
              <th style={thStyle}>Median</th>
              <th style={thStyle}>At Lowest</th>
              <th style={thStyle}>Above Low</th>
              <th style={thStyle}>Activity</th>
            </tr>
          </thead>
          <tbody>
            {(categoryStats as any[]).map((cat) => (
              <tr key={cat.key} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ ...tdStyle, textAlign: "left" }}>
                  <Link
                    href={"/best/" + cat.key}
                    style={{ textDecoration: "none", color: "var(--text-primary)", fontWeight: 600 }}
                  >
                    {cat.icon + " " + cat.label}
                  </Link>
                </td>
                <td style={tdStyle}>{cat.count}</td>
                <td style={tdStyle}>{formatPrice(cat.avg)}</td>
                <td style={tdStyle}>{formatPrice(cat.median)}</td>
                <td style={tdStyle}>
                  {cat.atLowest > 0 ? (
                    <span style={{ color: "var(--accent)", fontWeight: 600 }}>{cat.atLowest}</span>
                  ) : (
                    <span style={{ color: "var(--text-secondary)" }}>0</span>
                  )}
                </td>
                <td style={tdStyle}>
                  <span
                    style={{
                      fontWeight: 600,
                      color: cat.avgAboveLow < 3 ? "var(--accent)" : cat.avgAboveLow < 10 ? "var(--text-primary)" : "var(--danger)",
                    }}
                  >
                    {cat.avgAboveLow.toFixed(1) + "%"}
                  </span>
                </td>
                <td style={tdStyle}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      padding: "0.125rem 0.5rem",
                      borderRadius: 4,
                      background: cat.dropPercent > 30
                        ? "var(--accent-glow)"
                        : "rgba(255,255,255,0.05)",
                      color: cat.dropPercent > 30 ? "var(--accent)" : "var(--text-secondary)",
                    }}
                  >
                    {cat.dropPercent + "%"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Explanation */}
      <div className="card" style={{ padding: "1.5rem", marginBottom: "2rem" }}>
        <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: "1rem", marginBottom: "0.75rem" }}>
          How We Calculate This
        </h2>
        <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.8 }}>
          <p style={{ marginBottom: "0.75rem" }}>
            {"The TrackAura Price Index is built from raw scraped prices \u2014 no estimates, no third-party feeds. " +
            "We check every product at Canada Computers and Newegg Canada every 4 hours and record the actual listed price."}
          </p>
          <p style={{ marginBottom: "0.75rem" }}>
            {"\u201CAvg Above Low\u201D shows how far current prices are from the cheapest we\u2019ve ever recorded for each product. " +
            "A low percentage means most products are near their best prices. " +
            "\u201CActivity\u201D shows what percentage of products have seen at least one price change."}
          </p>
          <p>
            {"The overall trend chart aggregates the average price across all tracked products per day. " +
            "As our dataset grows, this page will add month-over-month comparisons and seasonal pattern analysis."}
          </p>
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <Link href="/products" className="btn-primary" style={{ textDecoration: "none", display: "inline-block" }}>
          Browse All Products
        </Link>
      </div>
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ textAlign: "center", padding: "0.75rem" }}>
      <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: "1.25rem", color: accent ? "var(--accent)" : "var(--text-primary)", marginBottom: "0.25rem" }}>
        {value}
      </p>
      <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{label}</p>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "0.75rem 0.5rem",
  textAlign: "right" as const,
  fontFamily: "'Sora', sans-serif",
  fontWeight: 600,
  fontSize: "0.75rem",
  color: "var(--text-secondary)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.03em",
};

const tdStyle: React.CSSProperties = {
  padding: "0.75rem 0.5rem",
  textAlign: "right" as const,
  color: "var(--text-primary)",
};
