"use client";

import Link from "next/link";
import { Product, CATEGORY_LABELS } from "@/types";
import { formatPrice, getAmazonSearchUrl } from "@/lib/utils";
```

Save the file, then verify:
```
Get-Content C:\Users\crown\trackaura-web\src\components\ProductCard.tsx -Head 3

function RetailerBadge({ retailer }: { retailer: string }) {
  const className = retailer === "Canada Computers" ? "badge-cc" : "badge-newegg";
  return (
    <span
      className={className}
      style={{
        padding: "0.1875rem 0.5rem",
        borderRadius: 999,
        fontSize: "0.6875rem",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {retailer}
    </span>
  );
}

export default function ProductCard({ product }: { product: Product }) {
  const hasDiscount = product.minPrice < product.maxPrice;
  const discountPercent = hasDiscount
    ? Math.round(((product.maxPrice - product.currentPrice) / product.maxPrice) * 100)
    : 0;
  const isAtLowest = product.currentPrice <= product.minPrice;

  return (
    <div className="card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Top row: category + retailer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            fontSize: "0.6875rem",
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontWeight: 600,
          }}
        >
          {CATEGORY_LABELS[product.category] || product.category}
        </span>
        <RetailerBadge retailer={product.retailer} />
      </div>

      {/* Product name */}
      <Link
        href={`/product/${product.slug}`}
        style={{
          fontFamily: "'Sora', sans-serif",
          fontWeight: 600,
          fontSize: "0.9375rem",
          color: "var(--text-primary)",
          textDecoration: "none",
          lineHeight: 1.4,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {product.name}
      </Link>

      {/* Price area */}
      <div style={{ marginTop: "auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
          <span className="price-tag" style={{ fontSize: "1.375rem" }}>
            {formatPrice(product.currentPrice)}
          </span>
          {hasDiscount && discountPercent > 0 && (
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--accent)",
                background: "var(--accent-glow)",
                padding: "0.125rem 0.375rem",
                borderRadius: 4,
              }}
            >
              -{discountPercent}%
            </span>
          )}
        </div>

        {/* Price range */}
        {hasDiscount && (
          <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            Range: {formatPrice(product.minPrice)} – {formatPrice(product.maxPrice)}
          </p>
        )}

        {isAtLowest && product.priceCount > 1 && (
          <p style={{ fontSize: "0.6875rem", color: "var(--accent)", fontWeight: 600, marginTop: "0.25rem" }}>
            ● Lowest tracked price
          </p>
        )}
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
        <Link href={`/product/${product.slug}`} className="btn-secondary" style={{ flex: 1, textAlign: "center", textDecoration: "none" }}>
          View History
        </Link>
        <a
          href={getAmazonSearchUrl(product.name)}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="btn-amazon"
          style={{ textDecoration: "none", whiteSpace: "nowrap" }}
          onClick={() => {
            if (typeof window !== "undefined" && (window as any).gtag) {
              (window as any).gtag("event", "affiliate_click", {
              event_category: "affiliate",
              event_label: product.name,
              retailer: "Amazon",
              product_category: product.category,
              price: product.currentPrice,
          });
        }
    }}
>
  Amazon
</a>
      </div>
    </div>
  );
}
