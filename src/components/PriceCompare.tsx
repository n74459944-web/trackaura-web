"use client";

import Link from "next/link";
import { Product } from "@/types";
import { getRetailerAffiliateUrl } from "@/lib/utils";

interface CompareProps {
  product: Product;
  similar: Product[];
}

export default function PriceCompare({ product, similar }: CompareProps) {
  if (similar.length === 0) return null;

  const allOptions = [product, ...similar].sort((a, b) => a.currentPrice - b.currentPrice);
  const cheapestPrice = allOptions[0].currentPrice;
  const savings = allOptions[allOptions.length - 1].currentPrice - cheapestPrice;

  const trackClick = (p: Product, event: string) => {
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", event, {
        event_category: event === "affiliate_click" ? "affiliate" : "outbound",
        event_label: p.name,
        retailer: p.retailer,
        product_category: p.category,
        price: p.currentPrice,
      });
    }
  };

  return (
    <div className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: "1rem" }}>
          Price Comparison
        </h2>
        {savings > 0 && (
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--accent)", background: "var(--accent-glow)", padding: "0.25rem 0.625rem", borderRadius: 999 }}>
            {"Save up to $" + savings.toFixed(2)}
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {allOptions.map((p) => {
          const isCheapest = p.currentPrice === cheapestPrice;
          const isCurrentProduct = p.id === product.id;
          const affiliateUrl = getRetailerAffiliateUrl(p);
          const isAffiliate = p.retailer === "Newegg Canada";

          return (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.875rem 1rem",
                borderRadius: 8,
                border: isCheapest ? "1px solid var(--accent)" : "1px solid var(--border)",
                background: isCheapest ? "var(--accent-glow)" : "transparent",
                gap: "0.75rem",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span
                      className={p.retailer === "Canada Computers" ? "badge-cc" : "badge-newegg"}
                      style={{ padding: "0.1875rem 0.5rem", borderRadius: 999, fontSize: "0.6875rem", fontWeight: 600 }}
                    >
                      {p.retailer}
                    </span>
                    {isCheapest && (
                      <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--accent)" }}>
                        {"\u2713 BEST PRICE"}
                      </span>
                    )}
                    {isCurrentProduct && !isCheapest && (
                      <span style={{ fontSize: "0.6875rem", color: "var(--text-secondary)" }}>
                        (viewing)
                      </span>
                    )}
                  </div>
                  {!isCurrentProduct && (
                    <Link
                      href={"/product/" + p.slug}
                      style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textDecoration: "none", marginTop: 3 }}
                    >
                      View price history
                    </Link>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span className="price-tag" style={{ fontSize: "1.25rem" }}>
                  {"$" + p.currentPrice.toFixed(2)}
                </span>
                <a
                  href={affiliateUrl}
                  target="_blank"
                  rel={isAffiliate ? "noopener noreferrer nofollow sponsored" : "noopener noreferrer"}
                  className={isCheapest ? "btn-primary" : "btn-secondary"}
                  style={{ textDecoration: "none", fontSize: "0.75rem", padding: "0.375rem 0.75rem", whiteSpace: "nowrap" }}
                  onClick={() => trackClick(p, isAffiliate ? "affiliate_click" : "retailer_click")}
                >
                  {isCheapest ? "Buy Now" : "View"}
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", marginTop: "0.75rem" }}>
        Prices compared across Canadian retailers using product matching. Products may have minor variations.
      </p>
    </div>
  );
}
