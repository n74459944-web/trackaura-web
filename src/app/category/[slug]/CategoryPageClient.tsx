"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Product, CATEGORY_LABELS, CATEGORY_ICONS, RETAILER_COLORS } from "@/types";
import ProductCard from "@/components/ProductCard";

// ── Types ──

interface BrandStat {
  name: string;
  count: number;
  avgPrice: number;
  minPrice: number;
  deals: number;
}

interface PriceChange {
  id: number;
  name: string;
  slug: string;
  retailer: string;
  category: string;
  oldPrice: number;
  newPrice: number;
  direction: string;
  changedAt: string;
  pctChange?: number;
}

interface CategoryStats {
  totalProducts: number;
  avgPrice: number;
  medianPrice: number;
  atLowest: number;
  withHistory: number;
  retailers: { name: string; count: number }[];
}

interface Props {
  slug: string;
  label: string;
  icon: string;
  products: Product[];
  brandStats: BrandStat[];
  recentChanges: PriceChange[];
  relatedCats: string[];
  catStats: CategoryStats;
}

// ── Tabs ──
type Tab = "all" | "deals" | "changes";

// ── Sort options ──
type SortKey = "popular" | "price-low" | "price-high" | "drop-pct" | "newest";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "popular", label: "Most Tracked" },
  { key: "price-low", label: "Price: Low → High" },
  { key: "price-high", label: "Price: High → Low" },
  { key: "drop-pct", label: "Biggest Drop" },
  { key: "newest", label: "Recently Added" },
];

const PAGE_SIZE = 36;

// ── Component ──

export default function CategoryPageClient({
  slug,
  label,
  icon,
  products,
  brandStats,
  recentChanges,
  relatedCats,
  catStats,
}: Props) {
  const [tab, setTab] = useState<Tab>("all");
  const [sort, setSort] = useState<SortKey>("popular");
  const [search, setSearch] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  const [selectedRetailers, setSelectedRetailers] = useState<Set<string>>(new Set());
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
  const [onlyAtLowest, setOnlyAtLowest] = useState(false);
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Price bounds for the slider
  const priceBounds = useMemo(() => {
    const prices = products.map((p) => p.currentPrice).sort((a, b) => a - b);
    if (prices.length === 0) return { min: 0, max: 1000 };
    return {
      min: Math.floor(prices[0]),
      max: Math.ceil(prices[prices.length - 1]),
    };
  }, [products]);

  // Initialize price range once
  const effectiveRange: [number, number] =
    priceRange[0] === 0 && priceRange[1] === 0
      ? [priceBounds.min, priceBounds.max]
      : priceRange;

  // Retailer list from data
  const retailers = useMemo(() => {
    const set = new Set(products.map((p) => p.retailer));
    return [...set].sort();
  }, [products]);

  // ── Filtering + sorting ──

  const filtered = useMemo(() => {
    let list = [...products];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }

    // Brand filter
    if (selectedBrands.size > 0) {
      list = list.filter((p) => {
        const brand = p.brand || "Unknown";
        return selectedBrands.has(brand);
      });
    }

    // Retailer filter
    if (selectedRetailers.size > 0) {
      list = list.filter((p) => selectedRetailers.has(p.retailer));
    }

    // Price range
    list = list.filter(
      (p) => p.currentPrice >= effectiveRange[0] && p.currentPrice <= effectiveRange[1]
    );

    // At lowest only
    if (onlyAtLowest) {
      list = list.filter((p) => p.currentPrice <= p.minPrice && p.priceCount > 1);
    }

    // Tab: deals = products with real price drops
    if (tab === "deals") {
      list = list.filter(
        (p) =>
          p.minPrice < p.maxPrice &&
          p.currentPrice < p.maxPrice &&
          p.priceCount >= 3
      );
    }

    // Sort
    switch (sort) {
      case "price-low":
        list.sort((a, b) => a.currentPrice - b.currentPrice);
        break;
      case "price-high":
        list.sort((a, b) => b.currentPrice - a.currentPrice);
        break;
      case "drop-pct":
        list.sort((a, b) => {
          const aDrop = a.maxPrice > 0 ? (a.maxPrice - a.currentPrice) / a.maxPrice : 0;
          const bDrop = b.maxPrice > 0 ? (b.maxPrice - b.currentPrice) / b.maxPrice : 0;
          return bDrop - aDrop;
        });
        break;
      case "newest":
        list.sort((a, b) => new Date(b.firstSeen).getTime() - new Date(a.firstSeen).getTime());
        break;
      case "popular":
      default:
        list.sort((a, b) => b.priceCount - a.priceCount);
        break;
    }

    return list;
  }, [products, search, selectedBrands, selectedRetailers, effectiveRange, onlyAtLowest, tab, sort]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // Brand toggle
  const toggleBrand = (brand: string) => {
    const next = new Set(selectedBrands);
    if (next.has(brand)) next.delete(brand);
    else next.add(brand);
    setSelectedBrands(next);
    setVisibleCount(PAGE_SIZE);
  };

  // Retailer toggle
  const toggleRetailer = (retailer: string) => {
    const next = new Set(selectedRetailers);
    if (next.has(retailer)) next.delete(retailer);
    else next.add(retailer);
    setSelectedRetailers(next);
    setVisibleCount(PAGE_SIZE);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearch("");
    setSelectedBrands(new Set());
    setSelectedRetailers(new Set());
    setPriceRange([0, 0]);
    setOnlyAtLowest(false);
    setVisibleCount(PAGE_SIZE);
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    selectedBrands.size > 0 ||
    selectedRetailers.size > 0 ||
    onlyAtLowest ||
    (priceRange[0] !== 0 || priceRange[1] !== 0);

  const brandsToShow = showAllBrands ? brandStats : brandStats.slice(0, 12);

  return (
    <div>
      {/* ── Tabs ── */}
      <div
        style={{
          display: "flex",
          gap: "0.25rem",
          marginBottom: "1.5rem",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "0",
        }}
      >
        {(
          [
            { key: "all" as Tab, label: "All Products", count: products.length },
            {
              key: "deals" as Tab,
              label: "Deals",
              count: products.filter(
                (p) => p.minPrice < p.maxPrice && p.currentPrice < p.maxPrice && p.priceCount >= 3
              ).length,
            },
            { key: "changes" as Tab, label: "Price Changes", count: recentChanges.length },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setVisibleCount(PAGE_SIZE);
            }}
            style={{
              padding: "0.625rem 1rem",
              fontSize: "0.8125rem",
              fontWeight: 600,
              fontFamily: "'Sora', sans-serif",
              background: "none",
              border: "none",
              borderBottom: tab === t.key ? "2px solid var(--accent)" : "2px solid transparent",
              color: tab === t.key ? "var(--accent)" : "var(--text-secondary)",
              cursor: "pointer",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {t.label}
            <span
              style={{
                marginLeft: "0.375rem",
                fontSize: "0.6875rem",
                opacity: 0.7,
              }}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Price Changes Tab ── */}
      {tab === "changes" ? (
        <div>
          {recentChanges.length === 0 ? (
            <div
              className="card"
              style={{
                padding: "2rem",
                textAlign: "center",
                color: "var(--text-secondary)",
              }}
            >
              <p style={{ fontSize: "0.9375rem", marginBottom: "0.5rem" }}>
                No price changes in the last 3 days for {label.toLowerCase()}.
              </p>
              <p style={{ fontSize: "0.8125rem" }}>
                Check back soon — we update every 4 hours.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {recentChanges.map((c, i) => {
                const pct =
                  c.oldPrice > 0
                    ? Math.abs(((c.newPrice - c.oldPrice) / c.oldPrice) * 100).toFixed(1)
                    : "0";
                const isDown = c.direction === "down";
                return (
                  <Link
                    key={`${c.id}-${i}`}
                    href={`/product/${c.slug}`}
                    className="card"
                    style={{
                      padding: "0.875rem 1.25rem",
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "1rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <p
                        style={{
                          fontFamily: "'Sora', sans-serif",
                          fontWeight: 600,
                          fontSize: "0.8125rem",
                          color: "var(--text-primary)",
                          marginBottom: "0.25rem",
                          lineHeight: 1.4,
                        }}
                      >
                        {c.name.length > 80 ? c.name.slice(0, 80) + "…" : c.name}
                      </p>
                      <p style={{ fontSize: "0.6875rem", color: "var(--text-secondary)" }}>
                        {c.retailer} ·{" "}
                        {new Date(c.changedAt).toLocaleDateString("en-CA", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <div style={{ textAlign: "right", minWidth: 120 }}>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-secondary)",
                          textDecoration: "line-through",
                          marginRight: "0.5rem",
                        }}
                      >
                        ${c.oldPrice.toFixed(2)}
                      </span>
                      <span
                        style={{
                          fontSize: "0.9375rem",
                          fontWeight: 700,
                          color: isDown ? "var(--accent)" : "var(--danger)",
                        }}
                      >
                        ${c.newPrice.toFixed(2)}
                      </span>
                      <p
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          color: isDown ? "var(--accent)" : "var(--danger)",
                          marginTop: "0.125rem",
                        }}
                      >
                        {isDown ? "▼" : "▲"} {pct}%
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ── Products Tab (All + Deals) ── */
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>
          {/* ── Sidebar: Brands + Filters ── */}
          <aside
            className="category-sidebar"
            style={{
              width: 240,
              flexShrink: 0,
              position: "sticky",
              top: "5rem",
              maxHeight: "calc(100vh - 6rem)",
              overflowY: "auto",
            }}
          >
            {/* Search within category */}
            <div style={{ marginBottom: "1.25rem" }}>
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
                placeholder={`Search ${label.toLowerCase()}...`}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.8125rem",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  background: "var(--card-bg)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              />
            </div>

            {/* Retailer filter */}
            <div style={{ marginBottom: "1.25rem" }}>
              <p
                style={{
                  fontFamily: "'Sora', sans-serif",
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "0.5rem",
                }}
              >
                Retailer
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                {retailers.map((r) => (
                  <button
                    key={r}
                    onClick={() => toggleRetailer(r)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.375rem 0.5rem",
                      fontSize: "0.8125rem",
                      background: selectedRetailers.has(r)
                        ? "var(--accent-glow)"
                        : "transparent",
                      border: selectedRetailers.has(r)
                        ? "1px solid var(--accent)"
                        : "1px solid transparent",
                      borderRadius: 4,
                      color: "var(--text-primary)",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: RETAILER_COLORS[r] || "var(--text-secondary)",
                        flexShrink: 0,
                      }}
                    />
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Price range */}
            <div style={{ marginBottom: "1.25rem" }}>
              <p
                style={{
                  fontFamily: "'Sora', sans-serif",
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "0.5rem",
                }}
              >
                Price Range
              </p>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  type="number"
                  value={effectiveRange[0]}
                  onChange={(e) => {
                    setPriceRange([Number(e.target.value), effectiveRange[1]]);
                    setVisibleCount(PAGE_SIZE);
                  }}
                  style={{
                    width: "50%",
                    padding: "0.375rem 0.5rem",
                    fontSize: "0.75rem",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    background: "var(--card-bg)",
                    color: "var(--text-primary)",
                  }}
                  min={priceBounds.min}
                  max={priceBounds.max}
                />
                <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>–</span>
                <input
                  type="number"
                  value={effectiveRange[1]}
                  onChange={(e) => {
                    setPriceRange([effectiveRange[0], Number(e.target.value)]);
                    setVisibleCount(PAGE_SIZE);
                  }}
                  style={{
                    width: "50%",
                    padding: "0.375rem 0.5rem",
                    fontSize: "0.75rem",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    background: "var(--card-bg)",
                    color: "var(--text-primary)",
                  }}
                  min={priceBounds.min}
                  max={priceBounds.max}
                />
              </div>
            </div>

            {/* At lowest toggle */}
            <div style={{ marginBottom: "1.25rem" }}>
              <button
                onClick={() => {
                  setOnlyAtLowest(!onlyAtLowest);
                  setVisibleCount(PAGE_SIZE);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.5rem 0.625rem",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  background: onlyAtLowest ? "var(--accent-glow)" : "var(--card-bg)",
                  border: onlyAtLowest
                    ? "1px solid var(--accent)"
                    : "1px solid var(--border)",
                  borderRadius: 6,
                  color: onlyAtLowest ? "var(--accent)" : "var(--text-primary)",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                <span>{onlyAtLowest ? "✓" : "○"}</span>
                At Lowest Price
              </button>
            </div>

            {/* Brands */}
            <div>
              <p
                style={{
                  fontFamily: "'Sora', sans-serif",
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "0.5rem",
                }}
              >
                Brands
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
                {brandsToShow.map((b) => (
                  <button
                    key={b.name}
                    onClick={() => toggleBrand(b.name)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.375rem 0.5rem",
                      fontSize: "0.8125rem",
                      background: selectedBrands.has(b.name)
                        ? "var(--accent-glow)"
                        : "transparent",
                      border: selectedBrands.has(b.name)
                        ? "1px solid var(--accent)"
                        : "1px solid transparent",
                      borderRadius: 4,
                      color: "var(--text-primary)",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span>{b.name}</span>
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {b.count}
                    </span>
                  </button>
                ))}
              </div>
              {brandStats.length > 12 && (
                <button
                  onClick={() => setShowAllBrands(!showAllBrands)}
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--accent)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    marginTop: "0.5rem",
                    padding: 0,
                  }}
                >
                  {showAllBrands
                    ? "Show less"
                    : `Show all ${brandStats.length} brands`}
                </button>
              )}
            </div>

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                style={{
                  marginTop: "1rem",
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  background: "var(--danger-glow, rgba(239,68,68,0.1))",
                  border: "1px solid var(--danger, #ef4444)",
                  borderRadius: 6,
                  color: "var(--danger, #ef4444)",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                Clear All Filters
              </button>
            )}
          </aside>

          {/* ── Main content ── */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Mobile filter button */}
            <button
              className="mobile-filter-btn"
              onClick={() => setMobileFiltersOpen(true)}
              style={{
                display: "none", /* shown via media query */
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 1rem",
                fontSize: "0.8125rem",
                fontWeight: 600,
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text-primary)",
                cursor: "pointer",
                marginBottom: "1rem",
                width: "100%",
                justifyContent: "center",
              }}
            >
              <span>⚙</span> Filters & Brands
              {hasActiveFilters && (
                <span style={{ color: "var(--accent)", marginLeft: "0.25rem" }}>
                  ({selectedBrands.size + selectedRetailers.size + (onlyAtLowest ? 1 : 0)})
                </span>
              )}
            </button>

            {/* Sort bar */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                {filtered.length.toLocaleString()} product{filtered.length !== 1 ? "s" : ""}
                {hasActiveFilters && " (filtered)"}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <label
                  htmlFor="sort-select"
                  style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}
                >
                  Sort:
                </label>
                <select
                  id="sort-select"
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value as SortKey);
                    setVisibleCount(PAGE_SIZE);
                  }}
                  style={{
                    padding: "0.375rem 0.625rem",
                    fontSize: "0.8125rem",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    background: "var(--card-bg)",
                    color: "var(--text-primary)",
                  }}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active filter pills (mobile-friendly summary) */}
            {hasActiveFilters && (
              <div
                style={{
                  display: "flex",
                  gap: "0.375rem",
                  flexWrap: "wrap",
                  marginBottom: "1rem",
                }}
              >
                {[...selectedBrands].map((b) => (
                  <span
                    key={`brand-${b}`}
                    onClick={() => toggleBrand(b)}
                    style={{
                      padding: "0.25rem 0.625rem",
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      background: "var(--accent-glow)",
                      border: "1px solid var(--accent)",
                      borderRadius: 999,
                      color: "var(--accent)",
                      cursor: "pointer",
                    }}
                  >
                    {b} ✕
                  </span>
                ))}
                {[...selectedRetailers].map((r) => (
                  <span
                    key={`ret-${r}`}
                    onClick={() => toggleRetailer(r)}
                    style={{
                      padding: "0.25rem 0.625rem",
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      background: "var(--accent-glow)",
                      border: "1px solid var(--accent)",
                      borderRadius: 999,
                      color: "var(--accent)",
                      cursor: "pointer",
                    }}
                  >
                    {r} ✕
                  </span>
                ))}
                {onlyAtLowest && (
                  <span
                    onClick={() => setOnlyAtLowest(false)}
                    style={{
                      padding: "0.25rem 0.625rem",
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      background: "var(--accent-glow)",
                      border: "1px solid var(--accent)",
                      borderRadius: 999,
                      color: "var(--accent)",
                      cursor: "pointer",
                    }}
                  >
                    At Lowest ✕
                  </span>
                )}
              </div>
            )}

            {/* Product grid */}
            {visible.length === 0 ? (
              <div
                className="card"
                style={{
                  padding: "3rem 2rem",
                  textAlign: "center",
                  color: "var(--text-secondary)",
                }}
              >
                <p style={{ fontSize: "1.125rem", marginBottom: "0.5rem" }}>
                  No products match your filters
                </p>
                <p style={{ fontSize: "0.8125rem" }}>
                  Try adjusting your price range or clearing some filters.
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="btn-secondary"
                    style={{ marginTop: "1rem", fontSize: "0.8125rem" }}
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid-products">
                  {visible.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
                {hasMore && (
                  <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
                    <button
                      onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                      className="btn-secondary"
                      style={{
                        fontSize: "0.8125rem",
                        padding: "0.625rem 2rem",
                      }}
                    >
                      Show More ({filtered.length - visibleCount} remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Mobile filter overlay */}
      {mobileFiltersOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Backdrop */}
          <div
            onClick={() => setMobileFiltersOpen(false)}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
            }}
          />
          {/* Panel */}
          <div
            style={{
              position: "relative",
              marginTop: "auto",
              maxHeight: "80vh",
              overflowY: "auto",
              background: "var(--bg)",
              borderRadius: "16px 16px 0 0",
              padding: "1.5rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.25rem",
              }}
            >
              <p
                style={{
                  fontFamily: "'Sora', sans-serif",
                  fontWeight: 700,
                  fontSize: "1.125rem",
                }}
              >
                Filters
              </p>
              <button
                onClick={() => setMobileFiltersOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.25rem",
                  cursor: "pointer",
                  color: "var(--text-primary)",
                  padding: "0.25rem",
                }}
              >
                ✕
              </button>
            </div>

            {/* Search */}
            <div style={{ marginBottom: "1.25rem" }}>
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
                placeholder={`Search ${label.toLowerCase()}...`}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.875rem",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  background: "var(--card-bg)",
                  color: "var(--text-primary)",
                }}
              />
            </div>

            {/* Retailers */}
            <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
              Retailer
            </p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
              {retailers.map((r) => (
                <button
                  key={`m-${r}`}
                  onClick={() => toggleRetailer(r)}
                  style={{
                    padding: "0.375rem 0.75rem",
                    fontSize: "0.8125rem",
                    background: selectedRetailers.has(r) ? "var(--accent-glow)" : "var(--card-bg)",
                    border: selectedRetailers.has(r) ? "1px solid var(--accent)" : "1px solid var(--border)",
                    borderRadius: 999,
                    color: selectedRetailers.has(r) ? "var(--accent)" : "var(--text-primary)",
                    cursor: "pointer",
                  }}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* At Lowest */}
            <button
              onClick={() => {
                setOnlyAtLowest(!onlyAtLowest);
                setVisibleCount(PAGE_SIZE);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 0.75rem",
                fontSize: "0.8125rem",
                fontWeight: 600,
                background: onlyAtLowest ? "var(--accent-glow)" : "var(--card-bg)",
                border: onlyAtLowest ? "1px solid var(--accent)" : "1px solid var(--border)",
                borderRadius: 6,
                color: onlyAtLowest ? "var(--accent)" : "var(--text-primary)",
                cursor: "pointer",
                width: "100%",
                marginBottom: "1.25rem",
              }}
            >
              <span>{onlyAtLowest ? "✓" : "○"}</span>
              At Lowest Price Only
            </button>

            {/* Brands */}
            <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
              Brands
            </p>
            <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
              {brandStats.slice(0, 20).map((b) => (
                <button
                  key={`mb-${b.name}`}
                  onClick={() => toggleBrand(b.name)}
                  style={{
                    padding: "0.25rem 0.625rem",
                    fontSize: "0.75rem",
                    background: selectedBrands.has(b.name) ? "var(--accent-glow)" : "var(--card-bg)",
                    border: selectedBrands.has(b.name) ? "1px solid var(--accent)" : "1px solid var(--border)",
                    borderRadius: 999,
                    color: selectedBrands.has(b.name) ? "var(--accent)" : "var(--text-primary)",
                    cursor: "pointer",
                  }}
                >
                  {b.name} ({b.count})
                </button>
              ))}
            </div>

            {/* Apply button */}
            <button
              onClick={() => setMobileFiltersOpen(false)}
              className="btn-primary"
              style={{
                width: "100%",
                padding: "0.75rem",
                fontSize: "0.875rem",
                fontWeight: 600,
              }}
            >
              Show {filtered.length.toLocaleString()} Products
            </button>
          </div>
        </div>
      )}

      {/* Responsive styles */}
      <style jsx>{`
        @media (max-width: 768px) {
          .category-sidebar {
            display: none !important;
          }
          .mobile-filter-btn {
            display: flex !important;
          }
        }
        @media (min-width: 769px) {
          .mobile-filter-btn {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
