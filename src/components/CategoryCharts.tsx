"use client";

import { useState } from "react";
import PriceIndexChart from "@/components/PriceIndexChart";

interface CategoryChartData {
  key: string;
  label: string;
  icon: string;
  color: string;
  data: { date: string; avg: number; count: number }[];
  latestAvg: number;
  change: number | null;
}

export default function CategoryCharts({ categories }: { categories: CategoryChartData[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(categories.map((c) => c.key)));
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  return (
    <div>
      {/* Expand/Collapse all buttons */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
        <button
          onClick={expandAll}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "0.375rem 0.75rem",
            fontSize: "0.75rem",
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          Expand All
        </button>
        <button
          onClick={collapseAll}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "0.375rem 0.75rem",
            fontSize: "0.75rem",
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          Collapse All
        </button>
      </div>

      {/* Category cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {categories.map((cat) => {
          const isOpen = expanded.has(cat.key);
          const latestCount = cat.data[cat.data.length - 1]?.count || 0;

          return (
            <div
              key={cat.key}
              className="card"
              style={{
                overflow: "hidden",
                border: isOpen ? "1px solid " + cat.color + "33" : undefined,
              }}
            >
              {/* Header row — always visible, clickable */}
              <button
                onClick={() => toggle(cat.key)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "1rem 1.25rem",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-primary)",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ fontSize: "1.25rem" }}>{cat.icon}</span>
                  <div>
                    <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: "0.9375rem" }}>
                      {cat.label}
                    </span>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginLeft: "0.5rem" }}>
                      {latestCount.toLocaleString() + " products"}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  {/* Current avg price */}
                  <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: "0.9375rem" }}>
                    {"$" + cat.latestAvg.toFixed(0)}
                  </span>

                  {/* Change badge */}
                  {cat.change !== null && (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        padding: "0.125rem 0.5rem",
                        borderRadius: 4,
                        background: cat.change <= 0 ? "rgba(0,229,160,0.1)" : "rgba(255,107,107,0.1)",
                        color: cat.change <= 0 ? "var(--accent)" : "var(--danger, #ff6b6b)",
                      }}
                    >
                      {(cat.change > 0 ? "+" : "") + cat.change.toFixed(1) + "%"}
                    </span>
                  )}

                  {/* Expand arrow */}
                  <span
                    style={{
                      fontSize: "0.875rem",
                      color: "var(--text-secondary)",
                      transition: "transform 0.2s",
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  >
                    ▼
                  </span>
                </div>
              </button>

              {/* Chart — shown when expanded */}
              {isOpen && (
                <div style={{ padding: "0 1.25rem 1.25rem" }}>
                  <PriceIndexChart
                    data={cat.data}
                    chartId={cat.key}
                    color={cat.color}
                    height={220}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
