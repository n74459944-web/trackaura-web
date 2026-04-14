"use client";

import { useState, useTransition, useEffect, useMemo, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Product, CATEGORY_LABELS, SiteStats } from "@/types";
import ProductCard from "@/components/ProductCard";

interface Filters {
  category: string;
  retailer: string;
  search: string;
  minPrice?: number;
  maxPrice?: number;
  sort: string;
  page: number;
  pageSize: number;
}

interface ProductsClientProps {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
  filters: Filters;
  stats: SiteStats;
}

export default function ProductsClient({
  products,
  total,
  page,
  totalPages,
  filters,
  stats,
}: ProductsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // Controlled inputs — synced to URL on change (with debounce for search/price)
  const [searchInput, setSearchInput] = useState(filters.search);
  const [minPriceInput, setMinPriceInput] = useState(
    filters.minPrice !== undefined ? String(filters.minPrice) : "",
  );
  const [maxPriceInput, setMaxPriceInput] = useState(
    filters.maxPrice !== undefined ? String(filters.maxPrice) : "",
  );
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Keep inputs in sync when server provides fresh filters (e.g. clear filters)
  useEffect(() => { setSearchInput(filters.search); }, [filters.search]);
  useEffect(() => {
    setMinPriceInput(filters.minPrice !== undefined ? String(filters.minPrice) : "");
  }, [filters.minPrice]);
  useEffect(() => {
    setMaxPriceInput(filters.maxPrice !== undefined ? String(filters.maxPrice) : "");
  }, [filters.maxPrice]);

  // Update URL with patched params. Any filter change resets page to 1
  // unless `keepPage` is true (for the pagination controls themselves).
  function applyFilters(
    patch: Partial<{
      category: string;
      retailer: string;
      search: string;
      minPrice: string;
      maxPrice: string;
      sort: string;
      page: string;
    }>,
    opts: { keepPage?: boolean } = {},
  ) {
    const params = new URLSearchParams();
    const current = {
      category: filters.category,
      retailer: filters.retailer,
      search: filters.search,
      minPrice:
        filters.minPrice !== undefined ? String(filters.minPrice) : "",
      maxPrice:
        filters.maxPrice !== undefined ? String(filters.maxPrice) : "",
      sort: filters.sort,
      page: String(filters.page),
    };
    const merged = { ...current, ...patch };

    if (!opts.keepPage && !("page" in patch)) {
      merged.page = "1";
    }

    if (merged.category && merged.category !== "all") params.set("category", merged.category);
    if (merged.retailer && merged.retailer !== "all") params.set("retailer", merged.retailer);
    if (merged.search) params.set("q", merged.search);
    if (merged.minPrice) params.set("minPrice", merged.minPrice);
    if (merged.maxPrice) params.set("maxPrice", merged.maxPrice);
    if (merged.sort && merged.sort !== "biggest-drop") params.set("sort", merged.sort);
    if (merged.page && merged.page !== "1") params.set("page", merged.page);

    const qs = params.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;

    startTransition(() => {
      router.push(url, { scroll: false });
    });
  }

  // Debounced search — fire 350ms after user stops typing
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchInput === filters.search) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      applyFilters({ search: searchInput });
    }, 350);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Debounced price inputs — fire 500ms after user stops typing
  const priceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const currentMin =
      filters.minPrice !== undefined ? String(filters.minPrice) : "";
    const currentMax =
      filters.maxPrice !== undefined ? String(filters.maxPrice) : "";
    if (minPriceInput === currentMin && maxPriceInput === currentMax) return;
    if (priceTimerRef.current) clearTimeout(priceTimerRef.current);
    priceTimerRef.current = setTimeout(() => {
      applyFilters({
        minPrice: minPriceInput,
        maxPrice: maxPriceInput,
      });
    }, 500);
    return () => {
      if (priceTimerRef.current) clearTimeout(priceTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minPriceInput, maxPriceInput]);

  // Category pills ordered by count from stats (global, not current-filter)
  const orderedCategories = useMemo(() => {
    const counts = stats.productsByCategory || {};
    return Object.entries(CATEGORY_LABELS)
      .filter(([key]) => key !== "other" && (counts[key] || 0) > 0)
      .sort((a, b) => (counts[b[0]] || 0) - (counts[a[0]] || 0));
  }, [stats]);

  const retailers = useMemo(() => {
    return (stats.retailers || []).slice().sort();
  }, [stats]);

  const pageTitle =
    filters.category !== "all" && CATEGORY_LABELS[filters.category]
      ? CATEGORY_LABELS[filters.category]
      : "All Products";

  const hasActiveFilters =
    filters.category !== "all" ||
    filters.retailer !== "all" ||
    filters.minPrice !== undefined ||
    filters.maxPrice !== undefined ||
    filters.search !== "" ||
    filters.sort !== "biggest-drop";

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 1.5rem", opacity: isPending ? 0.6 : 1, transition: "opacity 0.15s" }}>
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
          {total.toLocaleString()} products
          {totalPages > 1 && ` · page ${page} of ${totalPages}`}
        </p>
      </div>

      {/* Inline search */}
      <div style={{ maxWidth: 480, marginBottom: "1.25rem" }}>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
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
        <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", alignItems: "center" }}>
          <button
            className={`filter-pill ${filters.category === "all" ? "active" : ""}`}
            onClick={() => applyFilters({ category: "all" })}
          >
            All
          </button>
          {orderedCategories
            .slice(0, showAllCategories ? 999 : 10)
            .map(([key, label]) => (
              <button
                key={key}
                className={`filter-pill ${filters.category === key ? "active" : ""}`}
                onClick={() => applyFilters({ category: key })}
              >
                {label}
              </button>
            ))}
          {!showAllCategories && orderedCategories.length > 10 && (
            <button
              className="filter-pill"
              onClick={() => setShowAllCategories(true)}
              style={{ fontStyle: "italic" }}
            >
              More ▾
            </button>
          )}
        </div>

        <div style={{ width: 1, height: 24, background: "var(--border)", margin: "0 0.25rem" }} />

        {/* Retailer pills */}
        <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
          <button
            className={`filter-pill ${filters.retailer === "all" ? "active" : ""}`}
            onClick={() => applyFilters({ retailer: "all" })}
          >
            All Retailers
          </button>
          {retailers.map((r) => (
            <button
              key={r}
              className={`filter-pill ${filters.retailer === r ? "active" : ""}`}
              onClick={() => applyFilters({ retailer: r })}
            >
              {r}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 24, background: "var(--border)", margin: "0 0.25rem" }} />

        {/* Price range */}
        <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
          <input
            type="number"
            value={minPriceInput}
            onChange={(e) => setMinPriceInput(e.target.value)}
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
          <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>–</span>
          <input
            type="number"
            value={maxPriceInput}
            onChange={(e) => setMaxPriceInput(e.target.value)}
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

        <div style={{ width: 1, height: 24, background: "var(--border)", margin: "0 0.25rem" }} />

        {/* Sort */}
        <select
          value={filters.sort}
          onChange={(e) => applyFilters({ sort: e.target.value })}
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

        {hasActiveFilters && (
          <button
            onClick={() => {
              setSearchInput("");
              setMinPriceInput("");
              setMaxPriceInput("");
              startTransition(() => {
                router.push(pathname, { scroll: false });
              });
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
      {products.length === 0 ? (
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
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

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
                onClick={() => applyFilters({ page: String(Math.max(1, page - 1)) }, { keepPage: true })}
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
                    onClick={() => applyFilters({ page: String(p) }, { keepPage: true })}
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
                onClick={() => applyFilters({ page: String(Math.min(totalPages, page + 1)) }, { keepPage: true })}
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
