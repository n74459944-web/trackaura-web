import Link from "next/link";
import { getAllProducts, getStats, getPriceIndex } from "@/lib/data";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/types";
import SearchBar from "@/components/SearchBar";
import ProductCard from "@/components/ProductCard";
import EmailSignup from "@/components/EmailSignup";
import fs from "fs";
import path from "path";

export const revalidate = 14400;

// ── Helpers ──

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
}

function getRecentDrops(): { feed: PriceChange[] } {
  try {
    const changesPath = path.join(process.cwd(), "public", "data", "changes.json");
    const raw = fs.readFileSync(changesPath, "utf-8");
    const all = JSON.parse(raw) as PriceChange[];
    const drops = all
      .filter((c) => {
        if (c.direction !== "down") return false;
        // Filter out junk drops: must be at least 2% AND $2
        const pct = c.oldPrice > 0 ? Math.abs((c.newPrice - c.oldPrice) / c.oldPrice) * 100 : 0;
        const dollars = Math.abs(c.oldPrice - c.newPrice);
        return pct >= 2 && dollars >= 2;
      })
      .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
      .slice(0, 6);
    return { feed: drops };
  } catch {
    return { feed: [] };
  }
}

export default async function HomePage() {
  const stats = await getStats();
  const allProducts = await getAllProducts();
  const { feed: dropFeed } = getRecentDrops();
  const priceIndex = await getPriceIndex();

  // ── Category data ──
  const categoryCounts: Record<string, number> = {};
  const categoryAtLowest: Record<string, number> = {};

  for (const p of allProducts) {
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
    if (p.currentPrice <= p.minPrice && p.priceCount > 1) {
      categoryAtLowest[p.category] = (categoryAtLowest[p.category] || 0) + 1;
    }
  }

  const categories = Object.entries(categoryCounts)
    .filter(([key, count]) => key !== "other" && count >= 50)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({
      key,
      label: CATEGORY_LABELS[key] || key,
      count,
      atLowest: categoryAtLowest[key] || 0,
      icon: CATEGORY_ICONS[key] || "📦",
    }));

  const topCategories = categories.slice(0, 12);

  // ── Featured deals ──
  const featured = (() => {
    const SKIP_KEYWORDS = [
      "server", "enterprise", "hpe ", "proliant", "rack mount",
      "ecc reg", "registered", "refurbished", "open box",
      "replacement", "spare", "oem", "bulk pack",
      "keycap", "key cap", "wrist rest", "cable", "adapter",
      "dongle", "converter", "extension", "splitter",
    ];
    const shouldSkip = (name: string) => {
      const lower = name.toLowerCase();
      return SKIP_KEYWORDS.some((kw) => lower.includes(kw));
    };
    const hasRealName = (name: string) => name.trim().split(/\s+/).length >= 3;

    const candidates = allProducts
      .filter((p) =>
        p.category !== "other" &&
        p.minPrice < p.maxPrice &&
        p.currentPrice < p.maxPrice &&
        p.currentPrice >= 30 &&
        p.currentPrice <= 3000 &&
        p.priceCount >= 3 &&
        p.maxPrice <= p.minPrice * 5 && // Filter out data errors
        !shouldSkip(p.name) &&
        hasRealName(p.name)
      )
      .map((p) => ({
        ...p,
        savings: p.maxPrice - p.currentPrice,
        dropPct: ((p.maxPrice - p.currentPrice) / p.maxPrice) * 100,
      }))
      .filter((p) => p.dropPct >= 10 && p.dropPct <= 70);

    const byCategory: Record<string, typeof candidates> = {};
    for (const p of candidates) {
      if (!byCategory[p.category]) byCategory[p.category] = [];
      byCategory[p.category].push(p);
    }
    for (const cat of Object.keys(byCategory)) {
      byCategory[cat].sort((a, b) => b.dropPct - a.dropPct);
    }

    const result: typeof candidates = [];
    const catKeys = Object.keys(byCategory).sort(
      (a, b) => (byCategory[b][0]?.dropPct || 0) - (byCategory[a][0]?.dropPct || 0)
    );
    let round = 0;
    while (result.length < 6 && round < 3) {
      for (const cat of catKeys) {
        if (result.length >= 6) break;
        const item = byCategory[cat][round];
        if (item) result.push(item);
      }
      round++;
    }
    return result;
  })();

  // ── Price Index one-liner ──
  const indexChange = priceIndex?.overallPctChange ?? null;
  const indexDays = priceIndex?.overall?.length ?? 0;

  return (
    <div>
      {/* ── Hero ── */}
      <section
        style={{
          padding: "3.5rem 1.5rem 2rem",
          maxWidth: 680,
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <h1
          className="animate-in"
          style={{
            fontFamily: "'Sora', sans-serif",
            fontWeight: 800,
            fontSize: "2.25rem",
            lineHeight: 1.15,
            marginBottom: "0.75rem",
          }}
        >
          The Canadian
          <br />
          <span className="gradient-text">Price Encyclopedia</span>
        </h1>
        <p
          className="animate-in animate-delay-1"
          style={{
            color: "var(--text-secondary)",
            fontSize: "1rem",
            lineHeight: 1.6,
            maxWidth: 480,
            margin: "0 auto 1.75rem",
          }}
        >
          {stats.totalProducts.toLocaleString() + " electronics products tracked daily across Canadian retailers."}
        </p>

        <div
          className="animate-in animate-delay-2"
          style={{ maxWidth: 520, margin: "0 auto", position: "relative", zIndex: 100 }}
        >
          <SearchBar large />
        </div>
      </section>

      {/* ── Retailer line ── */}
      <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", letterSpacing: "0.02em" }}>
          Tracking prices from{" "}
          <span style={{ color: "var(--cc-color, #e63946)", fontWeight: 600 }}>Canada Computers</span>
          {" · "}
          <span style={{ color: "var(--newegg-color, #f5a623)", fontWeight: 600 }}>Newegg Canada</span>
          {" · "}
          <span style={{ color: "var(--accent)", fontWeight: 600 }}>Vuugo</span>
        </p>
      </div>

      {/* ── Price Index one-liner ── */}
      {indexDays >= 2 && indexChange !== null && (
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <Link
            href="/trends"
            style={{
              fontSize: "0.8125rem",
              color: "var(--text-secondary)",
              textDecoration: "none",
            }}
          >
            {"📈 Price Index: electronics prices are "}
            <span
              style={{
                fontWeight: 700,
                color: indexChange <= -0.5 ? "var(--accent)" : indexChange >= 0.5 ? "var(--danger, #ff6b6b)" : "var(--text-primary)",
              }}
            >
              {indexChange <= -0.5
                ? "down " + Math.abs(indexChange).toFixed(1) + "%"
                : indexChange >= 0.5
                ? "up " + indexChange.toFixed(1) + "%"
                : "holding steady"}
            </span>
            {" over " + indexDays + " days "}
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>→</span>
          </Link>
        </div>
      )}

      {/* ── Categories (flat grid, top 12) ── */}
      <section style={{ maxWidth: 1200, margin: "0 auto 3rem", padding: "0 1.5rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <h2
            style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 700,
              fontSize: "1.25rem",
            }}
          >
            Browse by Category
          </h2>
          <Link href="/categories" className="accent-link" style={{ fontSize: "0.875rem" }}>
            {"All " + categories.length + " categories →"}
          </Link>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: "0.75rem",
          }}
        >
          {topCategories.map((cat) => (
            <Link
              key={cat.key}
              href={`/category/${cat.key}`}
              className="card"
              style={{
                padding: "1.25rem 0.75rem",
                textDecoration: "none",
                textAlign: "center",
                transition: "border-color 0.15s",
              }}
            >
              <span style={{ fontSize: "1.75rem", display: "block", marginBottom: "0.375rem" }}>
                {cat.icon}
              </span>
              <p
                style={{
                  fontFamily: "'Sora', sans-serif",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  color: "var(--text-primary)",
                  marginBottom: "0.25rem",
                  lineHeight: 1.3,
                }}
              >
                {cat.label}
              </p>
              <p style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", marginBottom: "0.125rem" }}>
                {cat.count.toLocaleString()} products
              </p>
              {cat.atLowest > 0 && (
                <p style={{ fontSize: "0.625rem", color: "var(--accent)", fontWeight: 600 }}>
                  {cat.atLowest} at lowest
                </p>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* ── Top Deals ── */}
      {featured.length > 0 && (
        <section style={{ maxWidth: 1200, margin: "0 auto 3rem", padding: "0 1.5rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <h2
              style={{
                fontFamily: "'Sora', sans-serif",
                fontWeight: 700,
                fontSize: "1.25rem",
              }}
            >
              Top Deals Right Now
            </h2>
            <Link href="/deals" className="accent-link" style={{ fontSize: "0.875rem" }}>
              All deals →
            </Link>
          </div>
          <div className="grid-products">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* ── Recent Price Drops ── */}
      {dropFeed.length > 0 && (
        <section style={{ maxWidth: 900, margin: "0 auto 3rem", padding: "0 1.5rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <h2
              style={{
                fontFamily: "'Sora', sans-serif",
                fontWeight: 700,
                fontSize: "1.25rem",
              }}
            >
              Recent Price Drops
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {dropFeed.map((c, i) => {
              const pct =
                c.oldPrice > 0
                  ? Math.abs(((c.newPrice - c.oldPrice) / c.oldPrice) * 100).toFixed(1)
                  : "0";
              return (
                <Link
                  key={`${c.id}-${i}`}
                  href={`/product/${c.slug}`}
                  className="card"
                  style={{
                    padding: "0.75rem 1.25rem",
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
                        marginBottom: "0.125rem",
                        lineHeight: 1.4,
                      }}
                    >
                      {c.name.length > 70 ? c.name.slice(0, 70) + "…" : c.name}
                    </p>
                    <p style={{ fontSize: "0.6875rem", color: "var(--text-secondary)" }}>
                      {c.retailer}
                      {" · "}
                      {CATEGORY_LABELS[c.category] || c.category}
                      {" · "}
                      {new Date(c.changedAt).toLocaleDateString("en-CA", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", minWidth: 110 }}>
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
                        color: "var(--accent)",
                      }}
                    >
                      ${c.newPrice.toFixed(2)}
                    </span>
                    <p
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        color: "var(--accent)",
                        marginTop: "0.125rem",
                      }}
                    >
                      ▼ {pct}%
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Email signup ── */}
      <section style={{ maxWidth: 600, margin: "0 auto 3rem", padding: "0 1.5rem" }}>
        <EmailSignup />
      </section>

      {/* ── How it works ── */}
      <section
        style={{
          maxWidth: 800,
          margin: "0 auto 4rem",
          padding: "0 1.5rem",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            fontFamily: "'Sora', sans-serif",
            fontWeight: 700,
            fontSize: "1.25rem",
            marginBottom: "1.5rem",
          }}
        >
          How It Works
        </h2>
        <div className="grid-howitworks">
          {[
            {
              step: "1",
              title: "Prices Get Logged",
              desc: "Every day, our system checks prices across Canada Computers, Newegg, and Vuugo.",
            },
            {
              step: "2",
              title: "History Builds Up",
              desc: "Over time you get a real price chart — so you can tell a genuine drop from a fake sale.",
            },
            {
              step: "3",
              title: "You Buy Smarter",
              desc: "Compare the same product across stores, or set a price alert and get emailed when it drops.",
            },
          ].map((item) => (
            <div key={item.step}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "var(--accent-glow)",
                  border: "1px solid var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 0.75rem",
                  fontFamily: "'Sora', sans-serif",
                  fontWeight: 700,
                  color: "var(--accent)",
                  fontSize: "0.875rem",
                }}
              >
                {item.step}
              </div>
              <p
                style={{
                  fontFamily: "'Sora', sans-serif",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                {item.title}
              </p>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer blurb ── */}
      <section style={{ maxWidth: 600, margin: "0 auto 4rem", padding: "0 1.5rem", textAlign: "center" }}>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.7 }}>
          Built in Quebec. TrackAura is an independent price tracker — not affiliated with any retailer.
          {" "}
          <Link href="/about" style={{ color: "var(--accent)" }}>Learn more →</Link>
        </p>
      </section>
    </div>
  );
}
