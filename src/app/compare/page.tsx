import { Metadata } from "next";
import Link from "next/link";
import { getAllProducts } from "@/lib/data";
import { CATEGORY_LABELS, CATEGORY_ICONS, RETAILER_COLORS } from "@/types";

export const metadata: Metadata = {
  title: "Compare Prices Across Canadian Retailers | TrackAura",
  description:
    "Side-by-side price comparison for electronics sold at both Canada Computers and Newegg Canada. See which retailer has the better price on the exact same product.",
  alternates: { canonical: "https://www.trackaura.com/compare" },
};

interface ComparisonGroup {
  canonicalId: number;
  name: string;
  shortName: string;
  category: string;
  brand: string;
  imageUrl: string;
  listings: {
    retailer: string;
    price: number;
    url: string;
    slug: string;
  }[];
  savings: number;
  savingsPct: number;
  cheapestRetailer: string;
}

export default function ComparePage() {
  const allProducts = getAllProducts();

  // Group products by canonicalId where multiple retailers exist
  const canonicalMap: Record<number, typeof allProducts> = {};
  for (const p of allProducts) {
    const cid = (p as any).canonicalId;
    if (!cid) continue;
    if (!canonicalMap[cid]) canonicalMap[cid] = [];
    canonicalMap[cid].push(p);
  }

  // Build comparison groups (only where 2+ retailers)
  const comparisons: ComparisonGroup[] = [];
  for (const [cidStr, products] of Object.entries(canonicalMap)) {
    const retailers = new Set(products.map((p) => p.retailer));
    if (retailers.size < 2) continue;

    // Pick one listing per retailer (prefer the cheapest)
    const byRetailer: Record<string, typeof products[0]> = {};
    for (const p of products) {
      if (!byRetailer[p.retailer] || p.currentPrice < byRetailer[p.retailer].currentPrice) {
        byRetailer[p.retailer] = p;
      }
    }

    const listings = Object.values(byRetailer).map((p) => ({
      retailer: p.retailer,
      price: p.currentPrice,
      url: p.url,
      slug: p.slug,
    }));

    const prices = listings.map((l) => l.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const savings = maxPrice - minPrice;
    const savingsPct = maxPrice > 0 ? (savings / maxPrice) * 100 : 0;
    const cheapest = listings.find((l) => l.price === minPrice)!;

    // Use the product with an image as the representative
    const representative = products.find((p) => p.imageUrl) || products[0];

    // Skip if prices are identical (no comparison value)
    if (savings < 1) continue;

    // Skip "other" category
    if (representative.category === "other") continue;
    // SANITY: skip if products are in different categories (bad canonical match)
    const productCategories = new Set(products.map((p) => p.category));
    if (productCategories.size > 1) {
      // Products matched canonically but categorized differently — likely a bad match
      // Only allow if categories are closely related (e.g. both are storage)
      const cats = [...productCategories];
      const RELATED_CATS: Record<string, string[]> = {
        "ssds": ["external-storage", "hard-drives"],
        "external-storage": ["ssds", "hard-drives"],
        "hard-drives": ["ssds", "external-storage"],
      };
      const areRelated = cats.length === 2 && RELATED_CATS[cats[0]]?.includes(cats[1]);
      if (!areRelated) continue;
    }

    // SANITY: skip if the cheaper price is less than 40% of the expensive one
    // This catches false matches (open box vs new, different revisions, etc.)
    if (minPrice < maxPrice * 0.4) continue;

    // SANITY: skip if either price is under $10 (data errors)
    if (minPrice < 10) continue;

    comparisons.push({
      canonicalId: Number(cidStr),
      name: representative.name,
      shortName: representative.shortName || representative.name.slice(0, 60),
      category: representative.category,
      brand: representative.brand || "",
      imageUrl: representative.imageUrl || "",
      listings: listings.sort((a, b) => a.price - b.price),
      savings,
      savingsPct,
      cheapestRetailer: cheapest.retailer,
    });
  }

  // Sort by savings amount (most savings first)
  comparisons.sort((a, b) => b.savings - a.savings);

  // Category counts
  const categoryCounts: Record<string, number> = {};
  for (const c of comparisons) {
    categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
  }
  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  // Stats
  const totalComparisons = comparisons.length;
  const avgSavings =
    comparisons.length > 0
      ? comparisons.reduce((sum, c) => sum + c.savings, 0) / comparisons.length
      : 0;
  const maxSavings = comparisons.length > 0 ? comparisons[0].savings : 0;

  const ccWins = comparisons.filter((c) => c.cheapestRetailer === "Canada Computers").length;
  const neWins = comparisons.filter((c) => c.cheapestRetailer === "Newegg Canada").length;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <style>{`
        .compare-card {
          display: grid;
          grid-template-columns: 48px 1fr;
          gap: 0.75rem;
          padding: 1rem;
          align-items: start;
        }
        .compare-card-noimg {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.75rem;
          padding: 1rem;
        }
        .compare-prices {
          display: flex;
          gap: 0.5rem;
          align-items: center;
          margin-top: 0.5rem;
          flex-wrap: wrap;
        }
        .compare-price-box {
          text-decoration: none;
          text-align: center;
          padding: 0.375rem 0.625rem;
          border-radius: 6px;
          min-width: 80px;
          flex-shrink: 0;
        }
        .compare-savings {
          text-align: center;
          flex-shrink: 0;
          min-width: 45px;
        }
        @media (min-width: 640px) {
          .compare-card {
            grid-template-columns: 48px 1fr auto;
            align-items: center;
          }
          .compare-card-noimg {
            grid-template-columns: 1fr auto;
            align-items: center;
          }
          .compare-prices {
            margin-top: 0;
            flex-wrap: nowrap;
          }
        }
      `}</style>

      <nav
        style={{
          display: "flex",
          gap: "0.5rem",
          fontSize: "0.8125rem",
          marginBottom: "1.5rem",
        }}
      >
        <Link href="/" className="accent-link">Home</Link>
        <span style={{ color: "var(--text-secondary)" }}>/</span>
        <span style={{ color: "var(--text-secondary)" }}>Compare Prices</span>
      </nav>

      <h1
        style={{
          fontFamily: "'Sora', sans-serif",
          fontWeight: 800,
          fontSize: "clamp(1.25rem, 4vw, 1.75rem)",
          marginBottom: "0.5rem",
        }}
      >
        {"🔀 Compare Prices: "}
        <span className="gradient-text">CC vs Newegg</span>
      </h1>
      <p
        style={{
          color: "var(--text-secondary)",
          fontSize: "0.875rem",
          lineHeight: 1.7,
          marginBottom: "2rem",
        }}
      >
        {totalComparisons.toLocaleString() +
          " products sold at both retailers with different prices. " +
          "Save an average of $" +
          avgSavings.toFixed(0) +
          " by picking the cheaper store."}
      </p>

      {/* Stats cards */}
      <div
        className="card"
        style={{
          padding: "1rem 1.25rem",
          marginBottom: "2rem",
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "0.75rem",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 700,
              fontSize: "1.125rem",
              color: "var(--accent)",
            }}
          >
            {totalComparisons}
          </p>
          <p style={{ fontSize: "0.6875rem", color: "var(--text-secondary)" }}>
            Products Compared
          </p>
        </div>
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 700,
              fontSize: "1.125rem",
              color: "var(--text-primary)",
            }}
          >
            {"$" + avgSavings.toFixed(0)}
          </p>
          <p style={{ fontSize: "0.6875rem", color: "var(--text-secondary)" }}>
            Avg Savings
          </p>
        </div>
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 700,
              fontSize: "1.125rem",
              color: "var(--text-primary)",
            }}
          >
            {"$" + maxSavings.toFixed(0)}
          </p>
          <p style={{ fontSize: "0.6875rem", color: "var(--text-secondary)" }}>
            Biggest Savings
          </p>
        </div>
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 700,
              fontSize: "1.125rem",
            }}
          >
            <span style={{ color: RETAILER_COLORS["Canada Computers"] }}>{ccWins}</span>
            {" vs "}
            <span style={{ color: RETAILER_COLORS["Newegg Canada"] }}>{neWins}</span>
          </p>
          <p style={{ fontSize: "0.6875rem", color: "var(--text-secondary)" }}>
            CC vs Newegg Wins
          </p>
        </div>
      </div>

      {/* Category pills */}
      <div
        style={{
          display: "flex",
          gap: "0.375rem",
          flexWrap: "wrap",
          marginBottom: "1.5rem",
        }}
      >
        {topCategories.map(([key, count]) => (
          <a
            key={key}
            href={"#cat-" + key}
            className="filter-pill"
            style={{ textDecoration: "none", fontSize: "0.75rem" }}
          >
            {(CATEGORY_ICONS[key] || "📦") +
              " " +
              (CATEGORY_LABELS[key] || key) +
              " (" +
              count +
              ")"}
          </a>
        ))}
      </div>

      {/* Comparison cards grouped by category */}
      {topCategories.map(([catKey, count]) => {
        const catComparisons = comparisons
          .filter((c) => c.category === catKey)
          .slice(0, 20);

        return (
          <div key={catKey} id={"cat-" + catKey} style={{ marginBottom: "2.5rem" }}>
            <h2
              style={{
                fontFamily: "'Sora', sans-serif",
                fontWeight: 700,
                fontSize: "1rem",
                marginBottom: "0.75rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span>{CATEGORY_ICONS[catKey] || "📦"}</span>
              <span>{CATEGORY_LABELS[catKey] || catKey}</span>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-secondary)",
                  fontWeight: 400,
                }}
              >
                {count + " comparisons"}
              </span>
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {catComparisons.map((comp) => (
                <div
                  key={comp.canonicalId}
                  className={"card " + (comp.imageUrl ? "compare-card" : "compare-card-noimg")}
                >
                  {comp.imageUrl && (
                    <img
                      src={comp.imageUrl}
                      alt=""
                      style={{
                        width: 48,
                        height: 48,
                        objectFit: "contain",
                        borderRadius: 4,
                      }}
                    />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <Link
                      href={"/product/" + comp.listings[0].slug}
                      style={{
                        color: "var(--text-primary)",
                        textDecoration: "none",
                        fontWeight: 600,
                        fontSize: "0.8125rem",
                        lineHeight: 1.4,
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {comp.shortName}
                    </Link>
                    <p
                      style={{
                        fontSize: "0.6875rem",
                        color: "var(--text-secondary)",
                        marginTop: "0.125rem",
                      }}
                    >
                      {comp.brand}
                      {comp.brand ? " · " : ""}
                      {CATEGORY_LABELS[comp.category] || comp.category}
                    </p>
                    {/* On mobile, prices show below the name */}
                    <div className="compare-prices" style={{ display: "flex" }}>
                      {comp.listings.map((listing, i) => (
                        <a
                          key={listing.retailer}
                          href={listing.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="compare-price-box"
                          style={{
                            textDecoration: "none",
                            background:
                              i === 0
                                ? "var(--accent-glow)"
                                : "rgba(255,255,255,0.03)",
                            border:
                              i === 0
                                ? "1px solid var(--accent)"
                                : "1px solid var(--border)",
                          }}
                        >
                          <p
                            style={{
                              fontFamily: "'Sora', sans-serif",
                              fontWeight: 700,
                              fontSize: "0.875rem",
                              color:
                                i === 0 ? "var(--accent)" : "var(--text-primary)",
                            }}
                          >
                            {"$" + listing.price.toFixed(2)}
                          </p>
                          <p
                            style={{
                              fontSize: "0.5625rem",
                              color:
                                i === 0
                                  ? "var(--accent)"
                                  : "var(--text-secondary)",
                              fontWeight: 500,
                            }}
                          >
                            {listing.retailer === "Canada Computers"
                              ? "Canada Computers"
                              : "Newegg"}
                          </p>
                        </a>
                      ))}
                      <div className="compare-savings">
                        <p
                          style={{
                            fontWeight: 700,
                            fontSize: "0.75rem",
                            color: "var(--accent)",
                          }}
                        >
                          {"-$" + comp.savings.toFixed(0)}
                        </p>
                        <p
                          style={{
                            fontSize: "0.5625rem",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {"save " + comp.savingsPct.toFixed(0) + "%"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* SEO content */}
      <div
        className="card"
        style={{
          padding: "1.5rem",
          marginTop: "2rem",
          marginBottom: "2rem",
        }}
      >
        <h2
          style={{
            fontFamily: "'Sora', sans-serif",
            fontWeight: 700,
            fontSize: "1rem",
            marginBottom: "0.75rem",
          }}
        >
          How Cross-Retailer Comparison Works
        </h2>
        <div
          style={{
            fontSize: "0.875rem",
            color: "var(--text-secondary)",
            lineHeight: 1.8,
          }}
        >
          <p style={{ marginBottom: "0.75rem" }}>
            {"TrackAura matches the exact same product across different retailers using manufacturer model numbers. " +
              "When Canada Computers and Newegg list the same GPU under different names, we identify it as one product and compare prices directly."}
          </p>
          <p style={{ marginBottom: "0.75rem" }}>
            {"We currently match " +
              totalComparisons.toLocaleString() +
              " products across Canada Computers and Newegg Canada. " +
              "On average, you save $" +
              avgSavings.toFixed(0) +
              " by checking both stores. " +
              "Neither retailer is always cheaper \u2014 it depends on the product and category."}
          </p>
          <p>
            {"Prices update every 4 hours. Set a price alert on any product and we\u2019ll email you when the price drops at either retailer."}
          </p>
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <Link
          href="/products"
          className="btn-primary"
          style={{ textDecoration: "none", display: "inline-block" }}
        >
          Browse All Products
        </Link>
      </div>
    </div>
  );
}
