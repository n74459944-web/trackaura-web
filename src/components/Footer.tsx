import Link from "next/link";

export default function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border)",
        padding: "3rem 1.5rem 2rem",
        marginTop: "4rem",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "2rem",
        }}
      >
        <div>
          <p
            style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 700,
              fontSize: "1rem",
              marginBottom: "0.5rem",
            }}
          >
            Track<span style={{ color: "var(--accent)" }}>Aura</span>
          </p>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.8125rem",
              maxWidth: 300,
              lineHeight: 1.6,
            }}
          >
            Canadian electronics price tracking. Compare prices across retailers
            and never overpay.
          </p>
        </div>

        <div style={{ display: "flex", gap: "3rem" }}>
          <div>
            <p
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "0.75rem",
                fontFamily: "'Sora', sans-serif",
              }}
            >
              Categories
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <Link href="/products?category=headphones" className="accent-link" style={{ fontSize: "0.875rem" }}>
                Headphones
              </Link>
              <Link href="/products?category=gpus" className="accent-link" style={{ fontSize: "0.875rem" }}>
                Graphics Cards
              </Link>
              <Link href="/products?category=ssds" className="accent-link" style={{ fontSize: "0.875rem" }}>
                SSDs
              </Link>
            </div>
          </div>
          <div>
            <p
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "0.75rem",
                fontFamily: "'Sora', sans-serif",
              }}
            >
              Retailers
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.875rem", color: "var(--cc-color)" }}>Canada Computers</span>
              <span style={{ fontSize: "0.875rem", color: "var(--newegg-color)" }}>Newegg Canada</span>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          maxWidth: 1200,
          margin: "2rem auto 0",
          paddingTop: "1.5rem",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "0.75rem",
          color: "var(--text-secondary)",
        }}
      >
        <p>&copy; {new Date().getFullYear()} TrackAura. Prices in CAD.</p>
        <p style={{ fontSize: "0.6875rem", opacity: 0.6 }}>
          As an Amazon Associate, TrackAura earns from qualifying purchases.
        </p>
      </div>
    </footer>
  );
}
