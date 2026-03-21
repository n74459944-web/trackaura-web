"use client";

import { Product } from "@/types";

export default function ProductInfo({ product }: { product: Product }) {
  const hasImage = product.imageUrl && product.imageUrl.startsWith("http");
  const hasDescription = product.description && product.description.length > 5;
  const hasSpecs = product.specs && Object.keys(product.specs).length > 0;
  const hasBrand = product.brand && product.brand.length > 1;

  if (!hasImage && !hasDescription && !hasSpecs) return null;

  return (
    <div className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
        {/* Product image */}
        {hasImage && (
          <div style={{
            width: 180,
            height: 180,
            flexShrink: 0,
            background: "#fff",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}>
            <img
              src={product.imageUrl}
              alt={product.shortName || product.name}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
              }}
              loading="lazy"
            />
          </div>
        )}

        {/* Info section */}
        <div style={{ flex: 1, minWidth: 200 }}>
          {/* Brand */}
          {hasBrand && (
            <p style={{
              fontSize: "0.75rem",
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: 600,
              marginBottom: "0.5rem",
            }}>
              {product.brand}
            </p>
          )}

          {/* Description */}
          {hasDescription && (
            <p style={{
              fontSize: "0.9375rem",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              marginBottom: "1rem",
            }}>
              {product.description}
            </p>
          )}

          {/* Specs */}
          {hasSpecs && (
            <div>
              <p style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "0.5rem",
              }}>
                Key Specs
              </p>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: "0.375rem",
              }}>
                {Object.entries(product.specs!).map(([key, value]) => (
                  <div
                    key={key}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "0.375rem 0.625rem",
                      background: "var(--bg-primary)",
                      borderRadius: 6,
                      fontSize: "0.8125rem",
                    }}
                  >
                    <span style={{ color: "var(--text-secondary)", textTransform: "capitalize" }}>
                      {key.replace(/_/g, " ")}
                    </span>
                    <span style={{ color: "var(--text-primary)", fontWeight: 600, marginLeft: "0.5rem" }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Product identifiers */}
          {(product.mpn || product.upc) && (
            <div style={{ marginTop: hasSpecs ? "0.75rem" : 0 }}>
              <div style={{
                display: "flex",
                gap: "1rem",
                flexWrap: "wrap",
                fontSize: "0.75rem",
                color: "var(--text-secondary)",
              }}>
                {product.mpn && (
                  <span>MPN: <strong style={{ color: "var(--text-primary)" }}>{product.mpn}</strong></span>
                )}
                {product.upc && (
                  <span>UPC: <strong style={{ color: "var(--text-primary)" }}>{product.upc}</strong></span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
