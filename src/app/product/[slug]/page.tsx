import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAllProducts,
  getProductBySlug,
  getPriceHistory,
  formatPrice,
  getAmazonSearchUrl,
} from "@/lib/data";
import { CATEGORY_LABELS } from "@/types";
import PriceChart from "@/components/PriceChart";

// Generate all product pages at build time
export function generateStaticParams() {
  const products = getAllProducts();
  return products.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const product = getProductBySlug(params.slug);
  if (!product) return { title: "Product Not Found" };

  return {
    title: `${product.name} Price History`,
    description: `Track the price history of ${product.name} at ${product.retailer}. Current price: $${product.currentPrice.toFixed(2)} CAD. Compare prices across Canadian retailers.`,
  };
}

export default function ProductPage({
  params,
}: {
  params: { slug: string };
}) {
  const product = getProductBySlug(params.slug);
  if (!product) notFound();

  const history = getPriceHistory(product.id);
  const isAtLowest = product.currentPrice <= product.minPrice && product.priceCount > 1;
  const hasRange = product.minPrice < product.maxPrice;
  const discountPercent = hasRange
    ? Math.round(((product.maxPrice - product.currentPrice) / product.maxPrice) * 100)
    : 0;

  // Find similar products from other retailers
  const allProducts = getAllProducts();
  const nameWords = product.name.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const similar = allProducts
    .filter(
      (p) =>
        p.id !== product.id &&
        p.retailer !== product.retailer &&
        nameWords.some((w) => p.name.toLowerCase().includes(w))
    )
    .slice(0, 5);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Breadcrumbs */}
      <nav style={{ display: "flex", gap: "0.5rem", fontSize: "0.8125rem", marginBottom: "1.5rem" }}>
        <Link href="/" className="accent-link">Home</Link>
        <span style={{ color: "var(--text-secondary)" }}>/</span>
        <Link href="/products" className="accent-link">Products</Link>
        <span style={{ color: "var(--text-secondary)" }}>/</span>
        <Link
          href={`/products?category=${product.category}`}
          className="accent-link"
        >
          {CATEGORY_LABELS[product.category] || product.category}
        </Link>
        <span style={{ color: "var(--text-secondary)" }}>/</span>
        <span style={{ color: "var(--text-secondary)" }}>
          {product.name.length > 40 ? product.name.slice(0, 40) + "…" : product.name}
        </span>
      </nav>

      {/* Product header */}
      <div className="card" style={{ padding: "2rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            {/* Retailer badge */}
            <span
              className={product.retailer === "Canada Computers" ? "badge-cc" : "badge-newegg"}
              style={{
                padding: "0.25rem 0.625rem",
                borderRadius: 999,
                fontSize: "0.75rem",
                fontWeight: 600,
                display: "inline-block",
                marginBottom: "0.75rem",
              }}
            >
              {product.retailer}
            </span>

            <h1
              style={{
                fontFamily: "'Sora', sans-serif",
                fontWeight: 700,
                fontSize: "1.5rem",
                lineHeight: 1.3,
                marginBottom: "1rem",
              }}
            >
              {product.name}
            </h1>

            {/* Price display */}
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", marginBottom: "0.5rem" }}>
              <span className="price-tag" style={{ fontSize: "2rem" }}>
                {formatPrice(product.currentPrice)}
              </span>
              <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>CAD</span>
              {hasRange && discountPercent > 0 && (
                <span
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "var(--accent)",
                    background: "var(--accent-glow)",
                    padding: "0.125rem 0.5rem",
                    borderRadius: 4,
                  }}
                >
                  {discountPercent}% below high
                </span>
              )}
            </div>

            {isAtLowest && (
              <p
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--accent)",
                  fontWeight: 600,
                  marginBottom: "0.75rem",
                }}
              >
                ● Currently at the lowest tracked price
              </p>
            )}

            {/* Price stats */}
            {hasRange && (
              <div
                style={{
                  display: "flex",
                  gap: "1.5rem",
                  fontSize: "0.8125rem",
                  color: "var(--text-secondary)",
                  marginBottom: "1rem",
                }}
              >
                <span>
                  Low: <strong style={{ color: "var(--accent)" }}>{formatPrice(product.minPrice)}</strong>
                </span>
                <span>
                  High: <strong style={{ color: "var(--danger)" }}>{formatPrice(product.maxPrice)}</strong>
                </span>
                <span>
                  {product.priceCount} price points
                </span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: 180 }}>
            <a
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
              style={{ textAlign: "center", textDecoration: "none" }}
            >
              View at {product.retailer}
            </a>
            <a
              href={getAmazonSearchUrl(product.name)}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="btn-amazon"
              style={{ textAlign: "center", textDecoration: "none" }}
            >
              Compare on Amazon
            </a>
          </div>
        </div>
      </div>

      {/* Price history chart */}
      <div className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
        <h2
          style={{
            fontFamily: "'Sora', sans-serif",
            fontWeight: 600,
            fontSize: "1rem",
            marginBottom: "1rem",
          }}
        >
          Price History
        </h2>
        <PriceChart
          data={history}
          currentPrice={product.currentPrice}
          minPrice={product.minPrice}
          maxPrice={product.maxPrice}
        />
        <p
          style={{
            fontSize: "0.75rem",
            color: "var(--text-secondary)",
            marginTop: "0.75rem",
            textAlign: "center",
          }}
        >
          Tracking since{" "}
          {new Date(product.firstSeen).toLocaleDateString("en-CA", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
          {" · "}
          Last updated{" "}
          {new Date(product.lastUpdated).toLocaleDateString("en-CA", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Cross-store comparison */}
      {similar.length > 0 && (
        <div className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
          <h2
            style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 600,
              fontSize: "1rem",
              marginBottom: "1rem",
            }}
          >
            Compare Across Stores
          </h2>
          <p
            style={{
              fontSize: "0.8125rem",
              color: "var(--text-secondary)",
              marginBottom: "1rem",
            }}
          >
            Similar products found at other retailers (name-based matching — may not be exact):
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {similar.map((p) => (
              <Link
                key={p.id}
                href={`/product/${p.slug}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.75rem 1rem",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  textDecoration: "none",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: "0.8125rem",
                      color: "var(--text-primary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {p.name}
                  </p>
                  <p style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", marginTop: 2 }}>
                    {p.retailer}
                  </p>
                </div>
                <span className="price-tag" style={{ fontSize: "0.9375rem", marginLeft: "1rem" }}>
                  {formatPrice(p.currentPrice)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div
        style={{
          padding: "1rem",
          fontSize: "0.75rem",
          color: "var(--text-secondary)",
          textAlign: "center",
          lineHeight: 1.6,
        }}
      >
        Prices are in Canadian dollars (CAD) and are scraped every 4 hours.
        Amazon links may earn TrackAura a commission.
      </div>
    </div>
  );
}
