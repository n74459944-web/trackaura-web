"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Product, CATEGORY_LABELS } from "@/types";
import ProductCard from "@/components/ProductCard";
import SearchBar from "@/components/SearchBar";

type SortKey = "name" | "price-asc" | "price-desc";

export default function ProductsClient() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") || "all";
  const initialRetailer = searchParams.get("retailer") || "all";

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState(initialCategory);
  const [retailer, setRetailer] = useState(initialRetailer);
  const [sort, setSort] = useState<SortKey>("name");
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

  // Sync URL params
  useEffect(() => {
    const c = searchParams.get("category");
    if (c) setCategory(c);
  }, [searchParams]);

  const filtered = useMemo(() => {
    let result = allProducts;
    if (category !== "all") result = result.filter((p) => p.category === category);
    if (retailer !== "all") result = result.filter((p) => p.retailer === retailer);
    if (sort === "price-asc") result = [...result].sort((a, b) => a.currentPrice - b.currentPrice);
    else if (sort === "price-desc") result = [...result].sort((a, b) => b.currentPrice - a.currentPrice);
    else result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [allProducts, category, retailer, sort]);

  const retailers = useMemo(() => {
    const set = new Set(allProducts.map((p) => p.retailer));
    return Array.from(set).sort();
  }, [allProducts]);

  const pageTitle =
    category !== "all" && CATEGORY_LABELS[category]
      ? CATEGORY_LABELS[category]
      : "All Products";

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Page header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1
          style={{
            fontFamily: "'Sora', sans-serif",
            fontWeight: 800,
            fontSize: "1.75rem",
            marginBottom: "0.5rem",
          }}
        >
          {pageTitle}
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
          {loading ? "Loading..." : `${filtered.length} products`}
        </p>
      </div>

      {/* Search */}
      <div style={{ maxWidth: 480, marginBottom: "1.5rem" }}>
        <SearchBar />
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          marginBottom: "1.5rem",
          alignItems: "center",
        }}
      >
        {/* Category pills */}
        <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
          <button
            className={`filter-pill ${category === "all" ? "active" : ""}`}
            onClick={() => setCategory("all")}
          >
            All
          </button>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <button
              key={key}
              className={`filter-pill ${category === key ? "active" : ""}`}
              onClick={() => setCategory(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div
          style={{ width: 1, height: 24, background: "var(--border)", margin: "0 0.25rem" }}
        />

        {/* Retailer pills */}
        <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
          <button
            className={`filter-pill ${retailer === "all" ? "active" : ""}`}
            onClick={() => setRetailer("all")}
          >
            All Retailers
          </button>
          {retailers.map((r) => (
            <button
              key={r}
              className={`filter-pill ${retailer === r ? "active" : ""}`}
              onClick={() => setRetailer(r)}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div
          style={{ width: 1, height: 24, background: "var(--border)", margin: "0 0.25rem" }}
        />

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "0.375rem 0.75rem",
            color: "var(--text-secondary)",
            fontSize: "0.8125rem",
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <option value="name">Sort: A-Z</option>
          <option value="price-asc">Sort: Price ↑</option>
          <option value="price-desc">Sort: Price ↓</option>
        </select>
      </div>

      {/* Product grid */}
      {loading ? (
        <div
          style={{
            padding: "4rem",
            textAlign: "center",
            color: "var(--text-secondary)",
          }}
        >
          Loading products...
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: "4rem",
            textAlign: "center",
            color: "var(--text-secondary)",
          }}
        >
          No products found with these filters.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1rem",
          }}
        >
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
