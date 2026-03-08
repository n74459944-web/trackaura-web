"use client";

import { useState, useEffect, useMemo } from "react";
import { Product, CATEGORY_LABELS } from "@/types";
import ProductCard from "@/components/ProductCard";

export default function DealsClient() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/data/products.json")
      .then((r) => r.json())
      .then((data) => {
        setAllProducts(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const deals = useMemo(() => {
    let products = allProducts.filter(
      (p) => p.minPrice < p.maxPrice && p.currentPrice < p.maxPrice
    );
    if (category !== "all") {
      products = products.filter((p) => p.category === category);
    }
    return products
      .map((p) => ({
        ...p,
        discount: Math.round(((p.maxPrice - p.currentPrice) / p.maxPrice) * 100),
      }))
      .sort((a, b) => b.discount - a.discount);
  }, [allProducts, category]);

  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    allProducts
      .filter((p) => p.minPrice < p.maxPrice && p.currentPrice < p.maxPrice)
      .forEach((p) => {
        counts[p.category] = (counts[p.category] || 0) + 1;
      });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [allProducts]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1
          style={{
            fontFamily: "'Sora', sans-serif",
            fontWeight: 800,
            fontSize: "1.75rem",
            marginBottom: "0.5rem",
          }}
        >
          Best <span className="gradient-text">Deals</span> Right Now
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.6 }}>
          Products currently priced below their tracked high. Sorted by biggest discount.
          Prices update every 4 hours.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          gap: "0.375rem",
          flexWrap: "wrap",
          marginBottom: "1.5rem",
        }}
      >
        <button
          className={`filter-pill ${category === "all" ? "active" : ""}`}
          onClick={() => setCategory("all")}
        >
          All ({deals.length})
        </button>
        {categories.map(([key, count]) => (
          <button
            key={key}
            className={`filter-pill ${category === key ? "active" : ""}`}
            onClick={() => setCategory(key)}
          >
            {CATEGORY_LABELS[key] || key} ({count})
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: "4rem", textAlign: "center", color: "var(--text-secondary)" }}>
          Loading deals...
        </div>
      ) : deals.length === 0 ? (
        <div style={{ padding: "4rem", textAlign: "center", color: "var(--text-secondary)" }}>
          No price drops detected yet. Check back as we collect more data!
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1rem",
          }}
        >
          {deals.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
