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
            Canadian electronics price tracking across 3 retailers.
            Compare prices and never overpay. Updated every 4 hours.
          </p>
        </div>

        <div style={{ display: "flex", gap: "3rem", flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem", fontFamily: "'Sora', sans-serif" }}>
              Categories
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <Link href="/products?category=gpus" className="accent-link" style={{ fontSize: "0.875rem" }}>Graphics Cards</Link>
              <Link href="/products?category=cpus" className="accent-link" style={{ fontSize: "0.875rem" }}>CPUs</Link>
              <Link href="/products?category=ram" className="accent-link" style={{ fontSize: "0.875rem" }}>RAM</Link>
              <Link href="/products?category=monitors" className="accent-link" style={{ fontSize: "0.875rem" }}>Monitors</Link>
              <Link href="/products?category=laptops" className="accent-link" style={{ fontSize: "0.875rem" }}>Laptops</Link>
              <Link href="/products" className="accent-link" style={{ fontSize: "0.875rem" }}>All Products</Link>
            </div>
          </div>
          <div>
            <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem", fontFamily: "'Sora', sans-serif" }}>
              Retailers We Track
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <a href="https://www.canadacomputers.com" target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.875rem", color: "var(--cc-color)", textDecoration: "none" }}>Canada Computers</a>
              <a href="https://www.newegg.ca" target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.875rem", color: "var(--newegg-color)", textDecoration: "none" }}>Newegg Canada</a>
              <a href="https://www.vuugo.com" target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.875rem", color: "var(--text-secondary)", textDecoration: "none" }}>Vuugo</a>
            </div>
          </div>
          <div>
            <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem", fontFamily: "'Sora', sans-serif" }}>
              Company
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <Link href="/about" className="accent-link" style={{ fontSize: "0.875rem" }}>About</Link>
              <Link href="/blog" className="accent-link" style={{ fontSize: "0.875rem" }}>Blog</Link>
              <Link href="/trends" className="accent-link" style={{ fontSize: "0.875rem" }}>Price Index</Link>
              <Link href="/privacy" className="accent-link" style={{ fontSize: "0.875rem" }}>Privacy Policy</Link>
              <Link href="/terms" className="accent-link" style={{ fontSize: "0.875rem" }}>Terms of Use</Link>
            </div>
          </div>
        </div>
      </div>

      {/* PriceTrail cross-link */}
      <div
        style={{
          maxWidth: 1200,
          margin: "2rem auto 0",
          padding: "1rem 1.25rem",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--card-bg, rgba(255,255,255,0.03))",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div>
          <p style={{ fontSize: "0.875rem", fontWeight: 600, fontFamily: "'Sora', sans-serif" }}>
            E-commerce seller?
          </p>
          <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Monitor competitor prices automatically — daily checks, email alerts, from $19/mo.
          </p>
        </div>
        <a
          href="https://www.pricetrail.app?ref=trackaura"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--accent)",
            textDecoration: "none",
            padding: "0.5rem 1rem",
            borderRadius: 6,
            border: "1px solid var(--accent)",
            whiteSpace: "nowrap",
          }}
        >
          Try PriceTrail →
        </a>
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
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <p>&copy; {new Date().getFullYear()} TrackAura. Prices in CAD.</p>
        <p style={{ fontSize: "0.6875rem", opacity: 0.6 }}>
          Some links may earn TrackAura a commission.
        </p>
      </div>
    </footer>
  );
}
