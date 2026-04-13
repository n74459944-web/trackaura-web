import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "6rem 1.5rem", textAlign: "center" }}>
      <p className="gradient-text" style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: "4rem", marginBottom: "1rem" }}>
        404
      </p>
      <h1 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: "1.5rem", marginBottom: "0.75rem" }}>
        Page Not Found
      </h1>
      <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem", lineHeight: 1.6, marginBottom: "2rem" }}>
        This product may have been removed or the URL might be incorrect. Try searching for what you need.
      </p>
      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
        <Link href="/" className="btn-primary" style={{ textDecoration: "none" }}>
          Go Home
        </Link>
        <Link href="/products" className="btn-secondary" style={{ textDecoration: "none" }}>
          Browse Products
        </Link>
      </div>
    </div>
  );
}
