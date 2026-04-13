export default function Loading() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Breadcrumb skeleton */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <div style={{ width: 40, height: 14, background: "var(--border)", borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite" }} />
        <div style={{ width: 8, height: 14 }} />
        <div style={{ width: 60, height: 14, background: "var(--border)", borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite" }} />
        <div style={{ width: 8, height: 14 }} />
        <div style={{ width: 80, height: 14, background: "var(--border)", borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite" }} />
      </div>

      {/* Product info card skeleton */}
      <div className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
          {/* Image skeleton */}
          <div style={{
            width: 180, height: 180, background: "var(--border)", borderRadius: 8,
            animation: "pulse 1.5s ease-in-out infinite", flexShrink: 0,
          }} />
          {/* Info skeleton */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ width: 80, height: 12, background: "var(--border)", borderRadius: 4, marginBottom: "0.75rem", animation: "pulse 1.5s ease-in-out infinite" }} />
            <div style={{ width: "90%", height: 16, background: "var(--border)", borderRadius: 4, marginBottom: "0.5rem", animation: "pulse 1.5s ease-in-out infinite" }} />
            <div style={{ width: "60%", height: 16, background: "var(--border)", borderRadius: 4, marginBottom: "1rem", animation: "pulse 1.5s ease-in-out infinite" }} />
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <div style={{ width: 100, height: 28, background: "var(--border)", borderRadius: 6, animation: "pulse 1.5s ease-in-out infinite" }} />
              <div style={{ width: 100, height: 28, background: "var(--border)", borderRadius: 6, animation: "pulse 1.5s ease-in-out infinite" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Main card skeleton */}
      <div className="card" style={{ padding: "2rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ width: 100, height: 22, background: "var(--border)", borderRadius: 999, marginBottom: "0.75rem", animation: "pulse 1.5s ease-in-out infinite" }} />
            <div style={{ width: "95%", height: 24, background: "var(--border)", borderRadius: 4, marginBottom: "0.5rem", animation: "pulse 1.5s ease-in-out infinite" }} />
            <div style={{ width: "70%", height: 24, background: "var(--border)", borderRadius: 4, marginBottom: "1rem", animation: "pulse 1.5s ease-in-out infinite" }} />
            <div style={{ width: 180, height: 40, background: "var(--border)", borderRadius: 4, marginBottom: "0.5rem", animation: "pulse 1.5s ease-in-out infinite" }} />
            <div style={{ display: "flex", gap: "1.5rem" }}>
              <div style={{ width: 80, height: 14, background: "var(--border)", borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite" }} />
              <div style={{ width: 80, height: 14, background: "var(--border)", borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite" }} />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: 180 }}>
            <div style={{ width: "100%", height: 40, background: "var(--border)", borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
            <div style={{ width: "100%", height: 40, background: "var(--border)", borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
          </div>
        </div>
      </div>

      {/* Chart skeleton */}
      <div className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
        <div style={{ width: 120, height: 16, background: "var(--border)", borderRadius: 4, marginBottom: "1rem", animation: "pulse 1.5s ease-in-out infinite" }} />
        <div style={{ width: "100%", height: 200, background: "var(--border)", borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.15; }
        }
      `}</style>
    </div>
  );
}
