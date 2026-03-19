"use client";

import { useState, useEffect, useMemo } from "react";
import { Product, CATEGORY_LABELS } from "@/types";
import ProductCard from "@/components/ProductCard";

interface DealsClientProps {
  initialProducts: Product[];
}

export default function DealsClient({ initialProducts }: DealsClientProps) {
  const [allProducts, setAllProducts] = useState<Product[]>(initialProducts);
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(initialProducts.length === 0);

  // Fallback: fetch client-side if server didn't provide data
  useEffect(() => {
    if (initialProducts.length === 0) {
      fetch("/data/products.json")
        .then((r) => r.json())
        .then((data) => {
          setAllProducts(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [initialProducts]);

  const deals = useMemo(() => {
    let products = allProducts.filter((p) => {
      // Basic: must have a price range
      if (p.minPrice >= p.maxPrice || p.currentPrice >= p.maxPrice) return false;

      // Sanity filter 1: skip products with implausibly low prices
      // A $1-$10 "deal" on electronics is almost always a data error
      if (p.currentPrice < 10) return false;

      // Sanity filter 2: skip products where max price is wildly inflated
      // If max is more than 4x the current price, the max was likely a data error
      if (p.maxPrice > p.currentPrice * 4) return false;

      // Sanity filter 3: need at least 3 price points for a reliable range
      // This prevents brand-new products with 1-2 scrapes from showing fake "deals"
      if (p.priceCount < 3) return false;

      // Sanity filter 4: discount must be at least 10% to be worth showing
      const discount = (p.maxPrice - p.currentPrice) / p.maxPrice;
      if (discount < 0.1) return false;

      return true;
    });

    if (category !== "all") {
      products = products.filter((p) => p.category === category);
    }

    return products
      .map((p) => ({
        ...p,
        discount: Math.round(
          ((p.maxPrice - p.currentPrice) / p.maxPrice) * 100
        ),
      }))
      .sort((a, b) => b.discount - a.discount)
      .slice(0, 100); // Cap at 100 deals to keep page fast
  }, [allProducts, category]);

  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    allProducts
      .filter((p) => {
        if (p.minPrice >= p.maxPrice || p.currentPrice >= p.maxPrice) return false;
        if (p.currentPrice < 10) return false;
        if (p.maxPrice > p.currentPrice * 4) return false;
        if (p.priceCount < 3) return false;
        const discount = (p.maxPrice - p.currentPrice) / p.maxPrice;
        return discount >= 0.1;
      })
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
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "0.875rem",
            lineHeight: 1.6,
          }}
        >
          Real price drops — at least 10% off with 3+ tracked data points.
          No inflated "discounts" from pricing errors. Updated every 4 hours.
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
        <div
          style={{
            padding: "4rem",
            textAlign: "center",
            color: "var(--text-secondary)",
          }}
        >
          Loading deals...
        </div>
      ) : deals.length === 0 ? (
        <div
          style={{
            padding: "4rem",
            textAlign: "center",
            color: "var(--text-secondary)",
          }}
        >
          No verified price drops right now. Check back as we collect more data!
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
