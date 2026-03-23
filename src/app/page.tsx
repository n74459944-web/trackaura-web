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
export default function HomePage() {
  const stats = getStats();
  const allProducts = getAllProducts();

  // Count recent price drops from changes.json
  const recentDrops = (() => {
    try {
      const changesPath = path.join(process.cwd(), "public", "data", "changes.json");
      const raw = fs.readFileSync(changesPath, "utf-8");
      const changes = JSON.parse(raw) as { direction: string; changedAt: string }[];
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      return changes.filter(
        (c) => c.direction === "down" && new Date(c.changedAt).getTime() > oneDayAgo
      ).length;
    } catch {
      return 0;
    }
  })();

  // Pick featured products: diverse categories, consumer-priced, real savings
  // Filters out data glitches, junk items, and accessories
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

    // Require a real product name (not just a brand name)
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
      // Tighter bounds: skip anything over 70% drop (likely data glitches)
      // and under 10% drop (not interesting enough for featured)
      .filter((p) => p.dropPct >= 10 && p.dropPct <= 70);

    // Group by category, pick best deal per category
    const byCategory: Record<string, typeof candidates> = {};
    for (const p of candidates) {
      if (!byCategory[p.category]) byCategory[p.category] = [];
      byCategory[p.category].push(p);
    }

    for (const cat of Object.keys(byCategory)) {
      byCategory[cat].sort((a, b) => b.dropPct - a.dropPct);
    }

    // Round-robin: 1 from each category, then 2nd from each, etc.
    const result: typeof candidates = [];
    const catKeys = Object.keys(byCategory).sort(
      (a, b) => (byCategory[b][0]?.dropPct || 0) - (byCategory[a][0]?.dropPct || 0)
    );
    let round = 0;
    while (result.length < 12 && round < 5) {
      for (const cat of catKeys) {
        if (result.length >= 12) break;
        const item = byCategory[cat][round];
        if (item) result.push(item);
      }
      round++;
    }

    return result;
  })();

  // Build categories dynamically from actual data
  const categoryCounts: Record<string, number> = {};
  for (const p of allProducts) {
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
  }
  const categories = Object.entries(categoryCounts)
    .filter(([key, count]) => key !== "other" && count >= 50)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({
      key,
      label: CATEGORY_LABELS[key] || key,
      count,
      icon: CATEGORY_ICONS[key] || "📦",
    }));

  const topCategories = categories.slice(0, 8);
  const topGuides = categories.slice(0, 6);

  return (
    <div>
      {/* Hero section */}
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
          Stop Guessing.
          <br />
          <span className="gradient-text">Check the Price History.</span>
        </h1>
        <p
          className="animate-in animate-delay-1"
          style={{
            color: "var(--text-secondary)",
            fontSize: "1.0625rem",
            lineHeight: 1.6,
            maxWidth: 560,
            margin: "0 auto 2rem",
          }}
        >
          We track {stats.totalProducts.toLocaleString()}+ products across 3 Canadian
          retailers every 4 hours so you can see if that &quot;sale&quot; is actually a deal.
        </p>

        {/* Search */}
        <div className="animate-in animate-delay-2" style={{ maxWidth: 560, margin: "0 auto", position: "relative", zIndex: 100 }}>
          <SearchBar large />
        </div>

        <p className="animate-in animate-delay-3" style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "1rem" }}>
          {recentDrops > 0
            ? `${recentDrops} price drops in the last 24 hours. `
            : "Prices updated every 4 hours. "}
          {"Compare the same product across stores. "}
          <Link href="/compare" style={{ color: "var(--accent)" }}>See comparisons &rarr;</Link>
        </p>
      </section>

      {/* Stats */}
      <section
        className="animate-in animate-delay-4"
        style={{ maxWidth: 700, margin: "0 auto 1.5rem", padding: "0 1.5rem" }}
      >
        <StatsBar stats={{ ...stats, categories: stats.categories.filter((c: string) => c !== "other") }} />
      </section>

      {/* Retailer ticker */}
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

      {/* Categories */}
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
            Browse Categories
          </h2>
          <Link href="/categories" className="accent-link" style={{ fontSize: "0.875rem" }}>
            {"All " + categories.length + " categories \u2192"}
          </Link>
        </div>
        <div className="grid-categories">
          {topCategories.map((cat) => (
            <Link
              key={cat.key}
              href={`/products?category=${cat.key}`}
              className="card"
              style={{
                padding: "1.25rem 0.75rem",
                textDecoration: "none",
                textAlign: "center",
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
                  marginBottom: "0.125rem",
                  lineHeight: 1.3,
                }}
              >
                {cat.label}
              </p>
              <p style={{ fontSize: "0.6875rem", color: "var(--text-secondary)" }}>
                {cat.count.toLocaleString()}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured products */}
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
            Today&apos;s Best Deals
          </h2>
          <Link href="/deals" className="accent-link" style={{ fontSize: "0.875rem" }}>
            All deals &rarr;
          </Link>
        </div>
        <div className="grid-products">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* Buying Guides */}
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
            {"All guides \u2192"}
          </Link>
        </div>
        <div className="grid-guides">
          {topGuides.map((cat) => (
            <Link
              key={"best-" + cat.key}
              href={"/best/" + cat.key}
              className="card"
              style={{ padding: "1rem 1.25rem", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.75rem" }}
            >
              <span style={{ fontSize: "1.5rem" }}>{cat.icon}</span>
              <div>
                <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)" }}>
                  {"Best " + cat.label}
                </p>
                <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  Deals & price drops
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Email signup */}
      <section style={{ maxWidth: 600, margin: "0 auto 3rem", padding: "0 1.5rem" }}>
        <EmailSignup />
      </section>

      {/* How it works */}
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
              desc: "Over time you get a real price chart \u2014 so you can tell a genuine drop from a fake sale.",
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

      {/* Built by */}
      <section style={{ maxWidth: 600, margin: "0 auto 4rem", padding: "0 1.5rem", textAlign: "center" }}>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.7 }}>
          Built in Quebec. TrackAura is an independent price tracker &mdash; not affiliated with any retailer.
          {" "}
          <Link href="/about" style={{ color: "var(--accent)" }}>Learn more &rarr;</Link>
        </p>
      </section>
    </div>
  );
}

