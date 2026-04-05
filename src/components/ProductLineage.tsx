import Link from "next/link";
import { Product } from "@/types";
import { formatPrice } from "@/lib/utils";

interface Generation {
  name: string;
  search: string;
  year: number;
}

export interface ResolvedLineage {
  line: string;
  previous?: { gen: Generation; product: Product | null };
  current: { gen: Generation };
  next?: { gen: Generation; product: Product | null };
}

interface Props {
  product: Product;
  lineage: ResolvedLineage | null;
}

export default function ProductLineage({ product, lineage }: Props) {
  if (!lineage) return null;
  if (!lineage.previous?.product && !lineage.next?.product) return null;

  return (
    <div className="card" style={{ padding: "1.25rem 1.5rem", marginBottom: "1.5rem" }}>
      <h2
        style={{
          fontFamily: "'Sora', sans-serif",
          fontWeight: 600,
          fontSize: "0.9375rem",
          marginBottom: "0.75rem",
        }}
      >
        {"Product Lineage — " + lineage.line}
      </h2>

      <div style={{ display: "flex", gap: "0.5rem", alignItems: "stretch", flexWrap: "wrap" }}>
        {/* Previous gen */}
        {lineage.previous && (
          <div style={{ flex: 1, minWidth: 140 }}>
            {lineage.previous.product ? (
              <Link
                href={"/product/" + lineage.previous.product.slug}
                style={{
                  display: "block",
                  textDecoration: "none",
                  padding: "0.75rem",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  height: "100%",
                }}
              >
                <p
                  style={{
                    fontSize: "0.625rem",
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "0.25rem",
                  }}
                >
                  {"← Previous (" + lineage.previous.gen.year + ")"}
                </p>
                <p
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    marginBottom: "0.25rem",
                  }}
                >
                  {lineage.previous.gen.name}
                </p>
                <p className="price-tag" style={{ fontSize: "0.875rem" }}>
                  {"From " + formatPrice(lineage.previous.product.currentPrice)}
                </p>
              </Link>
            ) : (
              <div
                style={{
                  padding: "0.75rem",
                  borderRadius: 8,
                  border: "1px dashed var(--border)",
                  height: "100%",
                  opacity: 0.5,
                }}
              >
                <p
                  style={{
                    fontSize: "0.625rem",
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "0.25rem",
                  }}
                >
                  {"← Previous (" + lineage.previous.gen.year + ")"}
                </p>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                  {lineage.previous.gen.name}
                </p>
                <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Not tracked</p>
              </div>
            )}
          </div>
        )}

        {/* Current */}
        <div style={{ flex: 1, minWidth: 140 }}>
          <div
            style={{
              padding: "0.75rem",
              borderRadius: 8,
              border: "1px solid var(--accent)",
              background: "var(--accent-glow)",
              height: "100%",
            }}
          >
            <p
              style={{
                fontSize: "0.625rem",
                color: "var(--accent)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 600,
                marginBottom: "0.25rem",
              }}
            >
              {"● Current (" + lineage.current.gen.year + ")"}
            </p>
            <p
              style={{
                fontSize: "0.8125rem",
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: "0.25rem",
              }}
            >
              {lineage.current.gen.name}
            </p>
            <p className="price-tag" style={{ fontSize: "0.875rem" }}>
              {formatPrice(product.currentPrice)}
            </p>
          </div>
        </div>

        {/* Next gen */}
        {lineage.next && (
          <div style={{ flex: 1, minWidth: 140 }}>
            {lineage.next.product ? (
              <Link
                href={"/product/" + lineage.next.product.slug}
                style={{
                  display: "block",
                  textDecoration: "none",
                  padding: "0.75rem",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  height: "100%",
                }}
              >
                <p
                  style={{
                    fontSize: "0.625rem",
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "0.25rem",
                  }}
                >
                  {"Next (" + lineage.next.gen.year + ") →"}
                </p>
                <p
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    marginBottom: "0.25rem",
                  }}
                >
                  {lineage.next.gen.name}
                </p>
                <p className="price-tag" style={{ fontSize: "0.875rem" }}>
                  {"From " + formatPrice(lineage.next.product.currentPrice)}
                </p>
              </Link>
            ) : (
              <div
                style={{
                  padding: "0.75rem",
                  borderRadius: 8,
                  border: "1px dashed var(--border)",
                  height: "100%",
                  opacity: 0.5,
                }}
              >
                <p
                  style={{
                    fontSize: "0.625rem",
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "0.25rem",
                  }}
                >
                  {"Next (" + lineage.next.gen.year + ") →"}
                </p>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                  {lineage.next.gen.name}
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
