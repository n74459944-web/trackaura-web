"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Product } from "@/types";
import { formatPrice } from "@/lib/utils";

interface SearchBarProps {
  large?: boolean;
}

export default function SearchBar({ large }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Load products data on mount
  useEffect(() => {
    fetch("/data/products.json")
      .then((r) => r.json())
      .then((data) => setAllProducts(data))
      .catch(() => {});
  }, []);

  // Search filtering
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    const q = query.toLowerCase();
    const words = q.split(/\s+/).filter((w) => w.length > 0);
    const filtered = allProducts
      .filter((p) => {
        const name = p.name.toLowerCase();
        return words.every((w) => name.includes(w));
      })
      .slice(0, 8);
    setResults(filtered);
    setIsOpen(filtered.length > 0);
  }, [query, allProducts]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} style={{ position: "relative", width: "100%" }}>
      <div style={{ position: "relative" }}>
        {/* Search icon */}
        <svg
          style={{
            position: "absolute",
            left: large ? 18 : 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-secondary)",
          }}
          width={large ? 20 : 16}
          height={large ? 20 : 16}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <circle cx={11} cy={11} r={8} />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products... (e.g. RTX 4070, Sony WH-1000XM5)"
          style={{
            width: "100%",
            padding: large ? "1rem 1rem 1rem 3rem" : "0.625rem 0.625rem 0.625rem 2.25rem",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: large ? 12 : 8,
            color: "var(--text-primary)",
            fontSize: large ? "1rem" : "0.875rem",
            outline: "none",
            fontFamily: "'DM Sans', sans-serif",
            transition: "border-color 0.15s",
          }}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim().length >= 2) {
              setIsOpen(false);
              window.location.href = "/search?q=" + encodeURIComponent(query.trim());
            }
          }}
        />
      </div>

      {/* Dropdown results */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            overflow: "hidden",
            zIndex: 9999,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            isolation: "isolate",
          }}
        >
          {results.map((product) => (
            <Link
              key={product.id}
              href={`/product/${product.slug}`}
              onClick={() => { setIsOpen(false); setQuery(""); }}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.75rem 1rem",
                textDecoration: "none",
                borderBottom: "1px solid var(--border)",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: 0 }}>
              {product.imageUrl && (
                <div style={{ width: 36, height: 36, flexShrink: 0, background: "#fff", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  <img src={product.imageUrl} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} loading="lazy" />
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--text-primary)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {product.shortName || product.name}
                </p>
                <p style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", marginTop: 2 }}>
                  {product.retailer}
                </p>
              </div>
            </div>
              <span className="price-tag" style={{ fontSize: "0.875rem", marginLeft: "1rem" }}>
                {formatPrice(product.currentPrice)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
