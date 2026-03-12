"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Product, CATEGORY_LABELS } from "@/types";
import ProductCard from "@/components/ProductCard";

type SortKey = "name" | "price-asc" | "price-desc" | "biggest-drop" | "at-lowest" | "newest";

const PRODUCTS_PER_PAGE = 48;

interface ProductsClientProps {
  initialProducts: Product[];
}

export default function ProductsClient({ initialProducts }: ProductsClientProps) {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") || "all";
  const initialRetailer = searchParams.get("retailer") || "all";

  const [allProducts, setAllProducts] = useState<Product[]>(initialProducts);
  const [category, setCategory] = useState(initialCategory);
  const [retailer, setRetailer] = useState(initialRetailer);
  const [sort, setSort] = useState<SortKey>("biggest-drop");
  const [loading, setLoading] = useState(initialProducts.length === 0);
  const [page, setPage] = useState(1);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Fallback: if server didn't provide products, fetch client-side
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

  // Sync URL params
  useEffect(() => {
    const c = searchParams.get("category");
    if (c) setCategory(c);
  }, [searchParams]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [category, retailer, sort, minPrice, maxPrice, searchQuery]);

  const filtered = useMemo(() => {
    let result = allProducts;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const words = q.split(/\s+/).filter((w) => w.length > 0);
      result = result.filter((p) => {
        const name = p.name.toLowerCase();
        return words.every((w) => name.includes(w));
      });
    }

    // Category filter
    if (category !== "all") result = result.filter((p) => p.category === category);

    // Retailer filter
    if (retailer !== "all") result = result.filter((p) => p.retailer === retailer);

    // Price range filter
    const min = parseFloat(minPrice);
    const max = parseFloat(maxPrice);
    if (!isNaN(min)) result = result.filter((p) => p.currentPrice >= min);
    if (!isNaN(max)) result = result.filter((p) => p.currentPrice <= max);

    // Sort
    if (sort === "price-asc") {
      result = [...result].sort((a, b) => a.currentPrice - b.currentPrice);
    } else if (sort === "price-desc") {
      result = [...result].sort((a, b) => b.currentPrice - a.currentPrice);
    } else if (sort === "biggest-drop") {
      result = [...result].sort((a, b) => {
        const aDrop = a.maxPrice > a.minPrice ? (a.maxPrice - a.currentPrice) / a.maxPrice : 0;
        const bDrop = b.maxPrice > b.minPrice ? (b.maxPrice - b.currentPrice) / b.maxPrice : 0;
        return bDrop - aDrop;
      });
    } else if (sort === "at-lowest") {
      result = [...result].sort((a, b) => {
        const aAtLow = a.currentPrice <= a.minPrice && a.priceCount > 1 ? 1 : 0;
        const bAtLow = b.currentPrice <= b.minPrice && b.priceCount > 1 ? 1 : 0;
        return bAtLow - aAtLow;
      });
    } else if (sort === "newest") {
      result = [...result].sort((a, b) => new Date(b.firstSeen).getTime() - new Date(a.firstSeen).getTime());
    } else {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [allProducts, category, retailer, sort, minPrice, maxPrice, searchQuery]);

  const totalPages = Math.ceil(filtered.length / PRODUCTS_PER_PAGE);
  const paginatedProducts = filtered.slice(
    (page - 1) * PRODUCTS_PER_PAGE,
    page * PRODUCTS_PER_PAGE
  );

  const retailers = useMemo(() => {
    const set = new Set(allProducts.map((p) => p.retailer));
    return Array.from(set).sort();
  }, [allProducts]);

  const pageTitle =
    category !== "all" && CATEGORY_LABELS[category]
      ? CATEGORY_LABELS[category]
      : "All Products";

  const atLowestCount = filtered.filter((p) => p.currentPrice <= p.minPrice && p.priceCount > 1).length;
  const withDropsCount = filtered.filter((p) => p.currentPrice < p.maxPrice && p.minPrice < p.maxPrice).length;

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
          {loading
            ? "Loading..."
            : filtered.length.toLocaleString() + " products" +
              (atLowestCount > 0 ? " \u00B7 " + atLowestCount + " at lowest price" : "") +
              (withDropsCount > 0 ? " \u00B7 " + withDropsCount + " with price drops" : "")}
        </p>
      </div>

      {/* Inline search */}
      <div style={{ maxWidth: 480, marginBottom: "1.25rem" }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter products..."
          style={{
            width: "100%",
            padding: "0.625rem 1rem",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--text-primary)",
            fontSize: "0.875rem",
            fontFamily: "'DM Sans', sans-serif",
            outline: "none",
          }}
        />
      </div>

      {/* Filters row */}
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
          {Object.entries(CATEGORY_LABELS)
            .filter(([key]) => key !== "other")
            .map(([key, label]) => (
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
        <div style={{ width: 1, height: 24, background: "var(--border)", margin: "0 0.25rem" }} />

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
        <div style={{ width: 1, height: 24, background: "var(--border)", margin: "0 0.25rem" }} />

        {/* Price range */}
        <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
          <input
            type="number"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="Min $"
            style={{
              width: 80,
              padding: "0.375rem 0.5rem",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text-primary)",
              fontSize: "0.8125rem",
              fontFamily: "'DM Sans', sans-serif",
              outline: "none",
            }}
          />
          <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>\u2013</span>
          <input
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Max $"
            style={{
              width: 80,
              padding: "0.375rem 0.5rem",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text-primary)",
              fontSize: "0.8125rem",
              fontFamily: "'DM Sans', sans-serif",
              outline: "none",
            }}
          />
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: "var(--border)", margin: "0 0.25rem" }} />

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
          <option value="biggest-drop">Sort: Biggest Drops</option>
          <option value="at-lowest">Sort: At Lowest Price</option>
          <option value="price-asc">Sort: Price Low → High</option>
          <option value="price-desc">Sort: Price High → Low</option>
          <option value="newest">Sort: Newest</option>
          <option value="name">Sort: A-Z</option>
        </select>

        {/* Clear filters */}
        {(category !== "all" || retailer !== "all" || minPrice || maxPrice || searchQuery) && (
          <button
            onClick={() => {
              setCategory("all");
              setRetailer("all");
              setMinPrice("");
              setMaxPrice("");
              setSearchQuery("");
              setSort("biggest-drop");
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--accent)",
              fontSize: "0.8125rem",
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              padding: "0.375rem 0.5rem",
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Product grid */}
      {loading ? (
        <div style={{ padding: "4rem", textAlign: "center", color: "var(--text-secondary)" }}>
          Loading products...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: "4rem", textAlign: "center", color: "var(--text-secondary)" }}>
          No products found with these filters.
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "1rem",
            }}
          >
            {paginatedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "0.5rem",
                marginTop: "2rem",
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                style={{
                  ...paginationBtnStyle,
                  opacity: page === 1 ? 0.3 : 1,
                  cursor: page === 1 ? "default" : "pointer",
                }}
              >
                ← Prev
              </button>

              {generatePageNumbers(page, totalPages).map((p, i) =>
                p === "..." ? (
                  <span key={"dots-" + i} style={{ color: "var(--text-secondary)", padding: "0 0.25rem" }}>
                    ...
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p as number)}
                    style={{
                      ...paginationBtnStyle,
                      background: page === p ? "var(--accent)" : "var(--bg-card)",
                      color: page === p ? "#06090f" : "var(--text-secondary)",
                      fontWeight: page === p ? 700 : 500,
                    }}
                  >
                    {p}
                  </button>
                )
              )}

              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                style={{
                  ...paginationBtnStyle,
                  opacity: page === totalPages ? 0.3 : 1,
                  cursor: page === totalPages ? "default" : "pointer",
                }}
              >
                Next →
              </button>

              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginLeft: "0.5rem" }}>
                {"Page " + page + " of " + totalPages}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const paginationBtnStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "0.5rem 0.75rem",
  color: "var(--text-secondary)",
  fontSize: "0.8125rem",
  cursor: "pointer",
  fontFamily: "'DM Sans', sans-serif",
  transition: "all 0.15s",
};

function generatePageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | string)[] = [1];

  if (current > 3) pages.push("...");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push("...");

  pages.push(total);

  return pages;
}
