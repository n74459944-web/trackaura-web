"use client";

import Link from "next/link";
import { Product } from "@/types";
import { formatPrice } from "@/lib/utils";
import { useState, useEffect } from "react";

interface Generation {
  name: string;
  search: string;
  year: number;
}

interface LineageData {
  line: string;
  previous?: Generation;
  current: Generation;
  next?: Generation;
}

interface LineageFile {
  gpu: { line: string; generations: Generation[] }[];
  cpu: { line: string; generations: Generation[] }[];
}

export default function ProductLineage({ product, allProducts }: { product: Product; allProducts: Product[] }) {
  const [lineage, setLineage] = useState<LineageData | null>(null);

  useEffect(() => {
    fetch("/data/product-lineage.json")
      .then((r) => r.json())
      .then((data: LineageFile) => {
        const nameLower = product.name.toLowerCase();
        const lines = [...(data.gpu || []), ...(data.cpu || [])];

        for (const line of lines) {
          for (let i = 0; i < line.generations.length; i++) {
            const gen = line.generations[i];
            if (nameLower.includes(gen.search)) {
              setLineage({
                line: line.line,
                previous: i > 0 ? line.generations[i - 1] : undefined,
                current: gen,
                next: i < line.generations.length - 1 ? line.generations[i + 1] : undefined,
              });
              return;
            }
          }
        }
      })
      .catch(() => {});
  }, [product.name]);

  if (!lineage) return null;

  // Find cheapest product matching each generation
  const findCheapest = (search: string) => {
    const matches = allProducts
      .filter((p) => p.name.toLowerCase().includes(search) && p.category === product.category)
      .sort((a, b) => a.currentPrice - b.currentPrice);
    return matches[0] || null;
  };

  const prevProduct = lineage.previous ? findCheapest(lineage.previous.search) : null;
  const nextProduct = lineage.next ? findCheapest(lineage.next.search) : null;

  // Don't show if no previous or next found in our catalog
  if (!prevProduct && !nextProduct) return null;

  return (
    <div className="card" style={{ padding: "1.25rem 1.5rem", marginBottom: "1.5rem" }}>
      <h2 style={{
        fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: "0.9375rem", marginBottom: "0.75rem",
      }}>
        {"Product Lineage — " + lineage.line}
      </h2>

      <div style={{ display: "flex", gap: "0.5rem", alignItems: "stretch", flexWrap: "wrap" }}>
        {/* Previous gen */}
        {lineage.previous && (
          <div style={{ flex: 1, minWidth: 140 }}>
            {prevProduct ? (
              <Link href={"/product/" + prevProduct.slug} style={{
                display: "block", textDecoration: "none", padding: "0.75rem",
                borderRadius: 8, border: "1px solid var(--border)", height: "100%",
              }}>
                <p style={{ fontSize: "0.625rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
                  {"← Previous (" + lineage.previous.year + ")"}
                </p>
                <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
                  {lineage.previous.name}
                </p>
                <p className="price-tag" style={{ fontSize: "0.875rem" }}>
                  {"From " + formatPrice(prevProduct.currentPrice)}
                </p>
              </Link>
            ) : (
              <div style={{ padding: "0.75rem", borderRadius: 8, border: "1px dashed var(--border)", height: "100%", opacity: 0.5 }}>
                <p style={{ fontSize: "0.625rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
                  {"← Previous (" + lineage.previous.year + ")"}
                </p>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                  {lineage.previous.name}
                </p>
                <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Not tracked</p>
              </div>
            )}
          </div>
        )}

        {/* Current */}
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{
            padding: "0.75rem", borderRadius: 8,
            border: "1px solid var(--accent)", background: "var(--accent-glow)", height: "100%",
          }}>
            <p style={{ fontSize: "0.625rem", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, marginBottom: "0.25rem" }}>
              {"● Current (" + lineage.current.year + ")"}
            </p>
            <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
              {lineage.current.name}
            </p>
            <p className="price-tag" style={{ fontSize: "0.875rem" }}>
              {formatPrice(product.currentPrice)}
            </p>
          </div>
        </div>

        {/* Next gen */}
        {lineage.next && (
          <div style={{ flex: 1, minWidth: 140 }}>
            {nextProduct ? (
              <Link href={"/product/" + nextProduct.slug} style={{
                display: "block", textDecoration: "none", padding: "0.75rem",
                borderRadius: 8, border: "1px solid var(--border)", height: "100%",
              }}>
                <p style={{ fontSize: "0.625rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
                  {"Next (" + lineage.next.year + ") →"}
                </p>
                <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
                  {lineage.next.name}
                </p>
                <p className="price-tag" style={{ fontSize: "0.875rem" }}>
                  {"From " + formatPrice(nextProduct.currentPrice)}
                </p>
              </Link>
            ) : (
              <div style={{ padding: "0.75rem", borderRadius: 8, border: "1px dashed var(--border)", height: "100%", opacity: 0.5 }}>
                <p style={{ fontSize: "0.625rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
                  {"Next (" + lineage.next.year + ") →"}
                </p>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                  {lineage.next.name}
                </p>
                <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Not tracked</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
