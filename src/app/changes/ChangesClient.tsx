"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { CATEGORY_LABELS } from "@/types";

interface PriceChange {
  name: string;
  slug: string;
  url: string;
  retailer: string;
  category: string;
  oldPrice: number;
  newPrice: number;
  diff: number;
  pct: number;
  direction: "up" | "down";
  changedAt: string;
}

interface ChangesClientProps {
  initialChanges: PriceChange[];
}

export default function ChangesClient({ initialChanges }: ChangesClientProps) {
  const [changes, setChanges] = useState<PriceChange[]>(initialChanges);
  const [filter, setFilter] = useState<"all" | "down" | "up">("all");
  const [loading, setLoading] = useState(initialChanges.length === 0);

  // Fallback: fetch client-side if server didn't provide data
  useEffect(() => {
    if (initialChanges.length === 0) {
      fetch("/data/changes.json")
        .then((r) => r.json())
        .then((data) => { setChanges(data); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [initialChanges]);

  const filtered = useMemo(() => {
    if (filter === "all") return changes;
    return changes.filter((c) => c.direction === filter);
  }, [changes, filter]);

  const drops = changes.filter((c) => c.direction === "down").length;
  const increases = changes.filter((c) => c.direction === "up").length;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: "1.75rem", marginBottom: "0.5rem" }}>
          Recent <span className="gradient-text">Price Changes</span>
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.6 }}>
          Real-time price movements across Canadian electronics retailers. Updated every 4 hours.
        </p>
      </div>

      <div style={{ display: "flex", gap: "0.375rem", marginBottom: "1.5rem" }}>
        <button className={"filter-pill " + (filter === "all" ? "active" : "")} onClick={() => setFilter("all")}>
          {"All (" + changes.length + ")"}
        </button>
        <button className={"filter-pill " + (filter === "down" ? "active" : "")} onClick={() => setFilter("down")} style={filter === "down" ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}}>
          {"\u2193 Price Drops (" + drops + ")"}
        </button>
        <button className={"filter-pill " + (filter === "up" ? "active" : "")} onClick={() => setFilter("up")} style={filter === "up" ? { borderColor: "var(--danger)", color: "var(--danger)" } : {}}>
          {"\u2191 Price Increases (" + increases + ")"}
        </button>
      </div>

      {loading ? (
        <div style={{ padding: "4rem", textAlign: "center", color: "var(--text-secondary)" }}>Loading price changes...</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
          <p style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>{"\uD83D\uDCCA"}</p>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem", lineHeight: 1.6 }}>
            No price changes detected yet. As we collect more data over the coming days, price movements will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          {filtered.map((change, i) => {
            const isDown = change.direction === "down";
            return (
              <div key={change.slug + "-" + i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.875rem 1.25rem", borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none", gap: "0.75rem", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <Link href={"/product/" + change.slug} style={{ fontSize: "0.875rem", color: "var(--text-primary)", textDecoration: "none", fontWeight: 500 }}>
                    {change.name}
                  </Link>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: 3 }}>
                    <span className={change.retailer === "Canada Computers" ? "badge-cc" : "badge-newegg"} style={{ padding: "0.125rem 0.375rem", borderRadius: 999, fontSize: "0.625rem", fontWeight: 600 }}>
                      {change.retailer}
                    </span>
                    <span style={{ fontSize: "0.6875rem", color: "var(--text-secondary)" }}>
                      {CATEGORY_LABELS[change.category] || change.category}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", textDecoration: "line-through" }}>
                    {"$" + change.oldPrice.toFixed(2)}
                  </span>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: isDown ? "var(--accent)" : "var(--danger)", background: isDown ? "var(--accent-glow)" : "rgba(239,68,68,0.15)", padding: "0.125rem 0.5rem", borderRadius: 4 }}>
                    {(isDown ? "\u2193 " : "\u2191 ") + Math.abs(change.pct) + "%"}
                  </span>
                  <span className="price-tag" style={{ fontSize: "1rem" }}>
                    {"$" + change.newPrice.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
