import Link from "next/link";
import { getAllProducts, getStats } from "@/lib/data";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/types";
import SearchBar from "@/components/SearchBar";
import StatsBar from "@/components/StatsBar";
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

function getRecentDrops(): { count24h: number; feed: PriceChange[] } {
  try {
    const changesPath = path.join(process.cwd(), "public", "data", "changes.json");
    const raw = fs.readFileSync(changesPath, "utf-8");
    const all = JSON.parse(raw) as PriceChange[];
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const drops = all.filter((c) => c.direction === "down");
    const count24h = drops.filter((c) => new Date(c.changedAt).getTime() > oneDayAgo).length;
    // Recent feed: last 8 drops regardless of time
    const feed = drops
      .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
      .slice(0, 8);
    return { count24h, feed };
  } catch {
    return { count24h: 0, feed: [] };
  }
}

export default function HomePage() {
  const stats = getStats();
  const allProducts = getAllProducts();
  const { count24h: recentDrops, feed: dropFeed } = getRecentDrops();

  // ── Category data ──
  const categoryCounts: Record<string, number> = {};
  const categoryDeals: Record<string, number> = {};
  const categoryAtLowest: Record<string, number> = {};

  for (const p of allProducts) {
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
    if (p.minPrice < p.maxPrice && p.currentPrice < p.maxPrice && p.priceCount >= 3) {
      categoryDeals[p.category] = (categoryDeals[p.category] || 0) + 1;
    }
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
      deals: categoryDeals[key] || 0,
      atLowest: categoryAtLowest[key] || 0,
      icon: CATEGORY_ICONS[key] || "📦",
    }));

  const topCategories = categories.slice(0, 12);
  const topGuides = categories.slice(0, 6);

  // ── Featured deals: diverse categories, consumer-priced, real savings ──
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
        !shouldSkip(p.name) &&
        hasRealName(p.name)
      )
      .map((p) => ({
        ...p,
        savings: p.maxPrice - p.currentPrice,
        dropPct: ((p.maxPrice - p.currentPrice) / p.maxPrice) * 100,
      }))
      .filter((p) => p.dropPct >= 10 && p.dropPct <= 70);

    // Round-robin across categories for diversity
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

  // ── Pulse stats ──
  const totalAtLowest = allProducts.filter(
    (p) => p.currentPrice <= p.minPrice && p.priceCount > 1
  ).length;
  const retailerCount = stats.retailers.length;

  return (
    <div>
      {/* ── Hero ── */}
      <section
        style={{
          padding: "4rem 1.5rem 3rem",
          maxWidth: 800,
          margin: "0 auto",
          textAlign: "center",
          position: "relative",
          zIndex: 10,
        }}
      >
        <h1
          className="animate-in"
          style={{
            fontFamily: "'Sora', sans-serif",
            fontWeight: 800,
            fontSize: "2.5rem",
            lineHeight: 1.15,
            marginBottom: "1rem",
          }}
        >
          The Canadian
          <br />
          <span className="gradient-text">Electronics Price Encyclopedia</span>
        </h1>
        <p
          className="animate-in animate-delay-1"
          style={{
            color: "var(--text-secondary)",
            fontSize: "1.0625rem",
            lineHeight: 1.6,
            maxWidth: 580,
            margin: "0 auto 2rem",
          }}
        >
          {`${stats.totalProducts.toLocaleString()} products across ${categories.length} categories from ${retailerCount} retailers. Price history updated every 4 hours so you can see if that "sale" is actually a deal.`}
        </p>

        {/* Search */}
        <div
          className="animate-in animate-delay-2"
          style={{ maxWidth: 560, margin: "0 auto", position: "relative", zIndex: 100 }}
        >
          <SearchBar large />
        </div>

        <p
          className="animate-in animate-delay-3"
          style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "1rem" }}
        >
          {recentDrops > 0 ? `${recentDrops} price drops in the last 24 hours` : "Prices updated every 4 hours"}
          {totalAtLowest > 0 && ` · ${totalAtLowest} products at their lowest tracked price`}
        </p>
      </section>

      {/* ── Pulse stats bar ── */}
      <section
        className="animate-in animate-delay-4"
        style={{ maxWidth: 700, margin: "0 auto 1.5rem", padding: "0 1.5rem" }}
      >
        <StatsBar stats={{ ...stats, categories: stats.categories.filter((c: string) => c !== "other") }} />
      </section>

      {/* ── Retailer ticker ── */}
      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", letterSpacing: "0.02em" }}>
          Tracking prices from{" "}
          <span style={{ color: "var(--cc-color, #e63946)", fontWeight: 600 }}>Canada Computers</span>
          {" · "}
          <span style={{ color: "var(--newegg-color, #f5a623)", fontWeight: 600 }}>Newegg Canada</span>
          {" · "}
          <span style={{ color: "var(--accent)", fontWeight: 600 }}>Vuugo</span>
        </p>
      </div>

      {/* ── Categories ── */}
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

      {/* ── Top Deals Spotlight ── */}
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

      {/* ── Buying Guides ── */}
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
            Buying Guides
          </h2>
          <Link href="/categories" className="accent-link" style={{ fontSize: "0.875rem" }}>
            {"All guides →"}
          </Link>
        </div>
        <div className="grid-guides">
          {topGuides.map((cat) => (
            <Link
              key={"best-" + cat.key}
              href={"/best/" + cat.key}
              className="card"
              style={{
                padding: "1rem 1.25rem",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
              <span style={{ fontSize: "1.5rem" }}>{cat.icon}</span>
              <div>
                <p
                  style={{
                    fontFamily: "'Sora', sans-serif",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    color: "var(--text-primary)",
                  }}
                >
                  {"Best " + cat.label}
                </p>
                <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  Data-driven picks & price drops
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

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
          How TrackAura Works
        </h2>
        <div className="grid-howitworks">
          {[
            {
              step: "1",
              title: "Prices Get Logged",
              desc: "Every 4 hours, our system checks prices across Canada Computers, Newegg, and Vuugo.",
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
