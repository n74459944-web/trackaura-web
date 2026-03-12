"use client";

import Link from "next/link";
import { Product, CATEGORY_LABELS } from "@/types";
import { formatPrice, getAmazonSearchUrl, getRetailerAffiliateUrl } from "@/lib/utils";

function RetailerBadge({ retailer }: { retailer: string }) {
  const cn = retailer === "Canada Computers" ? "badge-cc" : "badge-newegg";
  return (
    <span className={cn} style={{ padding: "0.1875rem 0.5rem", borderRadius: 999, fontSize: "0.6875rem", fontWeight: 600, whiteSpace: "nowrap" }}>
      {retailer}
    </span>
  );
}

function getRetailerShortName(retailer: string): string {
  if (retailer === "Canada Computers") return "CC";
  if (retailer === "Newegg Canada") return "Newegg";
  return retailer;
}

export default function ProductCard({ product }: { product: Product }) {
  const hasDiscount = product.minPrice < product.maxPrice;
  const discountPercent = hasDiscount ? Math.round(((product.maxPrice - product.currentPrice) / product.maxPrice) * 100) : 0;
  const isAtLowest = product.currentPrice <= product.minPrice;

  const trackClick = (event: string, retailer: string) => {
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", event, {
        event_category: event === "affiliate_click" ? "affiliate" : "outbound",
        event_label: product.name,
        retailer: retailer,
        product_category: product.category,
        price: product.currentPrice,
      });
    }
  };

  const retailerUrl = getRetailerAffiliateUrl(product);
  const isAffiliate = product.retailer === "Newegg Canada";
  const shortName = product.shortName || product.name;

  return (
    <div className="card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
          {CATEGORY_LABELS[product.category] || product.category}
        </span>
        <RetailerBadge retailer={product.retailer} />
      </div>

      {product.imageUrl && (
        <div style={{ width: "100%", height: 140, background: "#fff", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
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

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
        <Link href={"/product/" + product.slug} className="btn-secondary" style={{ flex: 1, textAlign: "center", textDecoration: "none" }}>
          View History
        </Link>
        <a
          href={retailerUrl}
          target="_blank"
          rel={isAffiliate ? "noopener noreferrer nofollow sponsored" : "noopener noreferrer"}
          className={product.retailer === "Newegg Canada" ? "btn-newegg" : "btn-cc"}
          style={{ textDecoration: "none", whiteSpace: "nowrap" }}
          onClick={function() { trackClick(isAffiliate ? "affiliate_click" : "retailer_click", product.retailer); }}
        >
          {getRetailerShortName(product.retailer)}
        </a>
        <a
          href={getAmazonSearchUrl(product.name)}
          target="_blank"
          rel="noopener noreferrer nofollow sponsored"
          className="btn-amazon"
          style={{ textDecoration: "none", whiteSpace: "nowrap" }}
          onClick={function() { trackClick("affiliate_click", "Amazon"); }}
        >
          Amazon
        </a>
      </div>
    </div>
  );
}
