"use client";

import Link from "next/link";
import { Product, CATEGORY_LABELS } from "@/types";
import { formatPrice } from "@/lib/utils";

function RetailerBadge({ retailer }: { retailer: string }) {
  let cn = "badge-cc";
  if (retailer === "Newegg Canada") cn = "badge-newegg";
  if (retailer === "Vuugo") cn = "badge-vuugo";
  return (
    <span className={cn} style={{ padding: "0.1875rem 0.5rem", borderRadius: 999, fontSize: "0.6875rem", fontWeight: 600, whiteSpace: "nowrap" }}>
      {retailer}
    </span>
  );
}

export default function ProductCard({ product }: { product: Product }) {
  const hasDiscount = product.minPrice < product.maxPrice;
  const discountPercent = hasDiscount ? Math.round(((product.maxPrice - product.currentPrice) / product.maxPrice) * 100) : 0;
  const isAtLowest = product.currentPrice <= product.minPrice;

  const rawName = product.shortName || product.name;
  const shortName = rawName
    .replace(/^\*+/, "")
    .replace(/^\((?:SI|Upgrade|OB|Refurbished)\)\s*/i, "")
    .replace(/\s+features?\s+a\s+.*/i, "")
    .replace(/\s+is\s+a\s+.*/i, "")
    .replace(/\s+is\s+\d+W\s+.*/i, "")
    .replace(/\s+is\s+(?:designed|built|made|compatible|compliant).*/i, "")
    .replace(/\s+is\s+(?:a\s+)?(?:power|the|an)\s+.*/i, "")
    .trim();

  return (
    <div className="card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
          {CATEGORY_LABELS[product.category] || product.category}
        </span>
        <RetailerBadge retailer={product.retailer} />
      </div>

      {product.imageUrl && (
        <div style={{ width: "100%", height: 140, background: product.imageUrl ? "#fff" : "var(--bg-primary)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          <img
            src={product.imageUrl}
            alt={shortName}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
            loading="lazy"
          />
        </div>
      )}

      <Link href={"/product/" + product.slug} title={product.name} style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: "0.9375rem", color: "var(--text-primary)", textDecoration: "none", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {shortName}
      </Link>

      <div style={{ marginTop: "auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
          <span className="price-tag" style={{ fontSize: "1.375rem" }}>{formatPrice(product.currentPrice)}</span>
          {hasDiscount && discountPercent > 0 && (
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--accent)", background: "var(--accent-glow)", padding: "0.125rem 0.375rem", borderRadius: 4 }}>
              -{discountPercent}%
            </span>
          )}
        </div>
        {hasDiscount && (
          <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            {"Range: " + formatPrice(product.minPrice) + " \u2013 " + formatPrice(product.maxPrice)}
          </p>
        )}
        {isAtLowest && product.priceCount > 1 && (
          <p style={{ fontSize: "0.6875rem", color: "var(--accent)", fontWeight: 600, marginTop: "0.25rem" }}>
            {"\u25CF Lowest tracked price"}
          </p>
        )}
      </div>

      <Link
        href={"/product/" + product.slug}
        className="btn-secondary"
        style={{ textAlign: "center", textDecoration: "none", marginTop: "0.5rem" }}
      >
        View History
      </Link>
    </div>
  );
}
