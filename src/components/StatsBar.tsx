import { SiteStats } from "@/types";

export default function StatsBar({ stats }: { stats: SiteStats }) {
  // Count visible categories: exclude "other" and categories with fewer than 5 products
  const visibleCategories = Object.entries(stats.productsByCategory || {})
    .filter(([key, count]) => key !== "other" && count >= 5)
    .length;

  const items = [
    { label: "Products Tracked", value: stats.totalProducts.toLocaleString() },
    { label: "Price Points", value: stats.totalPricePoints.toLocaleString() },
    { label: "Categories", value: visibleCategories.toString() },
    { label: "Price Updates", value: "Every 4 Hrs" },
  ];

  return (
    <>
      <div
        className="stats-grid"
        style={{
          display: "grid",
          gap: "1px",
          background: "var(--border)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {items.map((item) => (
          <div
            key={item.label}
            style={{
              background: "var(--bg-card)",
              padding: "1.25rem 1rem",
              textAlign: "center",
            }}
          >
            <p
              className="gradient-text"
              style={{
                fontFamily: "'Sora', sans-serif",
                fontWeight: 800,
                fontSize: "1.5rem",
                marginBottom: "0.25rem",
              }}
            >
              {item.value}
            </p>
            <p
              style={{
                fontSize: "0.6875rem",
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 600,
              }}
            >
              {item.label}
            </p>
          </div>
        ))}
      </div>

      {/* Retailer logos strip */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "0.5rem",
          marginTop: "1rem",
          fontSize: "0.75rem",
          color: "var(--text-secondary)",
        }}
      >
        <span>Tracking prices from</span>
        <span style={{ fontWeight: 700, color: "var(--cc-color)" }}>Canada Computers</span>
        <span style={{ color: "var(--border)" }}>•</span>
        <span style={{ fontWeight: 700, color: "var(--newegg-color)" }}>Newegg Canada</span>
        <span style={{ color: "var(--border)" }}>•</span>
        <span style={{ fontWeight: 700, color: "#ff9900" }}>Amazon.ca</span>
      </div>

      <style>{`
        .stats-grid {
          grid-template-columns: repeat(4, 1fr);
        }
        @media (max-width: 640px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </>
  );
}
