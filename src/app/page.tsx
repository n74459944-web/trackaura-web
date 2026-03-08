import Link from "next/link";
import { getAllProducts, getStats } from "@/lib/data";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/types";
import SearchBar from "@/components/SearchBar";
import StatsBar from "@/components/StatsBar";
import ProductCard from "@/components/ProductCard";

export default function HomePage() {
  const stats = getStats();
  const allProducts = getAllProducts();

  // Get a mix of products to feature (lowest-priced in each category)
  const featured = Object.keys(CATEGORY_LABELS)
    .flatMap((cat) => {
      const inCategory = allProducts
        .filter((p) => p.category === cat)
        .sort((a, b) => a.currentPrice - b.currentPrice);
      return inCategory.slice(0, 3);
    })
    .slice(0, 12);

  // Build categories dynamically from actual data
  const categoryCounts: Record<string, number> = {};
  for (const p of allProducts) {
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
  }
  const categories = Object.entries(categoryCounts)
    .filter(([key]) => key !== "other")
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({
      key,
      label: CATEGORY_LABELS[key] || key,
      count,
      icon: CATEGORY_ICONS[key] || "📦",
    }));

  return (
    <div>
      {/* Hero section */}
      <section
        style={{
          padding: "4rem 1.5rem 3rem",
          maxWidth: 800,
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <h1
          className="animate-in"
          style={{
            fontFamily: "'Sora', sans-serif",
            fontWeight: 800,
            fontSize: "2.5rem",
            lineHeight: 1.15,
            marginBottom: "1rem",
          }}
        >
          Track Canadian
          <br />
          <span className="gradient-text">Electronics Prices</span>
        </h1>
        <p
          className="animate-in animate-delay-1"
          style={{
            color: "var(--text-secondary)",
            fontSize: "1.0625rem",
            lineHeight: 1.6,
            maxWidth: 520,
            margin: "0 auto 2rem",
          }}
        >
          Price history for {categories.map(c => c.label.toLowerCase()).join(", ")}, and more across
          Canada Computers, Newegg, and Amazon.ca. Never overpay.
        </p>

        {/* Search */}
        <div className="animate-in animate-delay-2" style={{ maxWidth: 560, margin: "0 auto" }}>
          <SearchBar large />
        </div>
      </section>

      {/* Stats */}
      <section
        className="animate-in animate-delay-3"
        style={{ maxWidth: 700, margin: "0 auto 3rem", padding: "0 1.5rem" }}
      >
        <StatsBar stats={stats} />
      </section>

      {/* Categories */}
      <section style={{ maxWidth: 1200, margin: "0 auto 3rem", padding: "0 1.5rem" }}>
        <h2
          style={{
            fontFamily: "'Sora', sans-serif",
            fontWeight: 700,
            fontSize: "1.25rem",
            marginBottom: "1rem",
          }}
        >
          Browse Categories
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${Math.min(categories.length, 4)}, 1fr)`,
            gap: "1rem",
          }}
        >
          {categories.map((cat) => (
            <Link
              key={cat.key}
              href={`/products?category=${cat.key}`}
              className="card"
              style={{
                padding: "1.5rem",
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              <span style={{ fontSize: "2rem", display: "block", marginBottom: "0.5rem" }}>
                {cat.icon}
              </span>
              <p
                style={{
                  fontFamily: "'Sora', sans-serif",
                  fontWeight: 600,
                  fontSize: "1rem",
                  color: "var(--text-primary)",
                  marginBottom: "0.25rem",
                }}
              >
                {cat.label}
              </p>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                {cat.count} products
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section style={{ maxWidth: 1200, margin: "0 auto 3rem", padding: "0 1.5rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <h2
            style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 700,
              fontSize: "1.25rem",
            }}
          >
            Featured Products
          </h2>
          <Link href="/products" className="accent-link" style={{ fontSize: "0.875rem" }}>
            View all →
          </Link>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1rem",
          }}
        >
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* How it works */}
      <section
        style={{
          maxWidth: 800,
          margin: "0 auto 4rem",
          padding: "0 1.5rem",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            fontFamily: "'Sora', sans-serif",
            fontWeight: 700,
            fontSize: "1.25rem",
            marginBottom: "1.5rem",
          }}
        >
          How TrackAura Works
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2rem" }}>
          {[
            {
              step: "1",
              title: "We Scrape",
              desc: "Prices collected every 4 hours from Canadian retailers.",
            },
            {
              step: "2",
              title: "You Search",
              desc: "Find your product and see its complete price history.",
            },
            {
              step: "3",
              title: "You Save",
              desc: "Buy at the right time or compare on Amazon.ca.",
            },
          ].map((item) => (
            <div key={item.step}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "var(--accent-glow)",
                  border: "1px solid var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 0.75rem",
                  fontFamily: "'Sora', sans-serif",
                  fontWeight: 700,
                  color: "var(--accent)",
                  fontSize: "0.875rem",
                }}
              >
                {item.step}
              </div>
              <p
                style={{
                  fontFamily: "'Sora', sans-serif",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                {item.title}
              </p>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
