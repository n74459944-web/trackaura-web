"use client";

import Link from "next/link";
import { Product } from "@/types";
import { getRetailerAffiliateUrl } from "@/lib/utils";

interface CompareProps {
  product: Product;
  similar: Product[];
}

export default function PriceCompare({ product, similar }: CompareProps) {
  // Prefer pre-computed matches (exact same product across retailers)
  // Fall back to fuzzy similar products if no match data
  const comparisons = product.priceComparison && product.priceComparison.length > 0
    ? product.priceComparison
    : similar.map((p) => ({
        id: p.id,
        retailer: p.retailer,
        price: p.currentPrice,
        url: p.url,
        slug: p.slug,
      }));

  if (comparisons.length === 0) return null;

  // Build full options list: current product + comparisons
  const allOptions = [
    {
      id: product.id,
      retailer: product.retailer,
      price: product.currentPrice,
      url: product.url,
      slug: product.slug,
    },
    ...comparisons,
  ].sort((a, b) => a.price - b.price);

  const cheapestPrice = allOptions[0].price;
  const savings = allOptions[allOptions.length - 1].price - cheapestPrice;

  const isExactMatch = product.priceComparison && product.priceComparison.length > 0;

  const trackClick = (retailer: string, event: string) => {
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", event, {
        event_category: event === "affiliate_click" ? "affiliate" : "outbound",
        event_label: product.name,
        retailer,
        product_category: product.category,
      });
    }
  };

  return (
    <div className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: "1rem" }}>
          {isExactMatch ? "Price Comparison" : "Similar Products at Other Retailers"}
        </h2>
        {savings > 0 && (
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--accent)", background: "var(--accent-glow)", padding: "0.25rem 0.625rem", borderRadius: 999 }}>
            {"Save up to $" + savings.toFixed(2)}
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {allOptions.map((p) => {
          const isCheapest = p.price === cheapestPrice;
          const isCurrentProduct = p.id === product.id;
          const isNewegg = p.retailer === "Newegg Canada";
          const affiliateUrl = isCurrentProduct
            ? getRetailerAffiliateUrl(product)
            : p.url;

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
                  {"$" + p.price.toFixed(2)}
                </span>
                <a
                  href={affiliateUrl}
                  target="_blank"
                  rel={isNewegg ? "noopener noreferrer nofollow sponsored" : "noopener noreferrer"}
                  className={isCheapest ? "btn-primary" : "btn-secondary"}
                  style={{ textDecoration: "none", fontSize: "0.75rem", padding: "0.375rem 0.75rem", whiteSpace: "nowrap" }}
                  onClick={() => trackClick(p.retailer, isNewegg ? "affiliate_click" : "retailer_click")}
                >
                  {isCheapest ? "Buy Now" : "View"}
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", marginTop: "0.75rem" }}>
        {isExactMatch
          ? "Same product matched across retailers by model identification. Prices in CAD."
          : "Similar products matched by brand, model, and category. Products may have minor variations."}
      </p>
    </div>
  );
}
