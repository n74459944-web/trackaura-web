"use client";

import Link from "next/link";
import { Product } from "@/types";

export default function RelatedProducts({ products }: { products: Product[] }) {
  if (products.length === 0) return null;

  return (
    <div className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
      <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: "1rem", marginBottom: "1rem" }}>
        You Might Also Like
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.75rem" }}>
        {products.map((p) => (
          <Link
            key={p.id}
            href={"/product/" + p.slug}
            style={{
              padding: "0.875rem",
              borderRadius: 8,
              border: "1px solid var(--border)",
              textDecoration: "none",
              transition: "all 0.15s",
              display: "flex",
              flexDirection: "column",
              gap: "0.375rem",
            }}
          >
            <p style={{ fontSize: "0.8125rem", color: "var(--text-primary)", fontWeight: 500, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.4 }}>
              {p.name}
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
              <span className="price-tag" style={{ fontSize: "0.9375rem" }}>
                {"$" + p.currentPrice.toFixed(2)}
              </span>
              <span style={{ fontSize: "0.625rem", color: "var(--text-secondary)" }}>
                {p.retailer}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
