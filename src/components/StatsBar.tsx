import { SiteStats } from "@/types";

export default function StatsBar({ stats }: { stats: SiteStats }) {
  const items = [
    { label: "Products Tracked", value: stats.totalProducts.toLocaleString() },
    { label: "Price Points", value: stats.totalPricePoints.toLocaleString() },
    { label: "Retailers", value: stats.retailers.length.toString() },
    { label: "Categories", value: stats.categories.length.toString() },
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
