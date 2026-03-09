import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllProducts } from "@/lib/data";
import { formatPrice, getAmazonSearchUrl } from "@/lib/utils";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/types";
import ClickTracker from "@/components/ClickTracker";

export const dynamic = "force-dynamic";

const PRICE_RANGES: Record<string, number[]> = {
  gpus: [300, 500, 800, 1200],
  headphones: [25, 50, 100, 200],
  ssds: [50, 100, 150, 250],
  monitors: [200, 400, 700, 1200],
  keyboards: [30, 75, 150, 300],
  mice: [20, 50, 100, 200],
  laptops: [500, 800, 1200, 2000],
  ram: [50, 100, 150, 250],
  cpus: [150, 300, 500, 800],
  "power-supplies": [50, 100, 150, 250],
  cases: [50, 100, 150, 250],
  motherboards: [100, 200, 300, 500],
  coolers: [30, 60, 100, 200],
  routers: [50, 100, 200, 400],
  webcams: [30, 60, 100, 200],
  speakers: [25, 50, 100, 200],
  "external-storage": [50, 100, 150, 300],
};

type PageProps = { params: Promise<{ category: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  const label = CATEGORY_LABELS[category];
  if (!label) return { title: "Not Found" };

  const month = new Date().toLocaleString("en-CA", { month: "long" });
  const year = new Date().getFullYear();

  return {
    title: "Best " + label + " Deals in Canada — " + month + " " + year,
    description:
      "Find the best " + label.toLowerCase() + " prices in Canada for " + month + " " + year +
      ". Compare prices across Canada Computers and Newegg. Real price tracking data updated every 4 hours.",
    alternates: { canonical: "https://www.trackaura.com/best/" + category },
  };
}

export default async function BestCategoryPage({ params }: PageProps) {
  const { category } = await params;
  const label = CATEGORY_LABELS[category];
  if (!label) notFound();

  const icon = CATEGORY_ICONS[category] || "\uD83D\uDCE6";
  const allProducts = getAllProducts().filter((p) => p.category === category);
  const ranges = PRICE_RANGES[category] || [50, 100, 200, 500];
  const month = new Date().toLocaleString("en-CA", { month: "long" });
  const year = new Date().getFullYear();

  const cheapest = [...allProducts].sort((a, b) => a.currentPrice - b.currentPrice).slice(0, 5);
  const atLowest = allProducts.filter((p) => p.currentPrice <= p.minPrice && p.priceCount > 1).slice(0, 5);
  const biggestDrops = allProducts
    .filter((p) => p.minPrice < p.maxPrice && p.currentPrice < p.maxPrice)
    .map((p) => ({ ...p, drop: Math.round(((p.maxPrice - p.currentPrice) / p.maxPrice) * 100) }))
    .sort((a, b) => b.drop - a.drop)
    .slice(0, 5);

  const buckets = ranges.map((max, i) => {
    const min = i === 0 ? 0 : ranges[i - 1];
    const items = allProducts
      .filter((p) => p.currentPrice >= min && p.currentPrice < max)
      .sort((a, b) => a.currentPrice - b.currentPrice)
      .slice(0, 5);
    return { min, max, items };
  });

  const retailers = [...new Set(allProducts.map((p) => p.retailer))];

  // Compute stats for SEO content
  const prices = allProducts.map((p) => p.currentPrice);
  const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const medianPrice = prices.length > 0 ? [...prices].sort((a, b) => a - b)[Math.floor(prices.length / 2)] : 0;
  const lowestPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const highestPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const atLowestCount = allProducts.filter((p) => p.currentPrice <= p.minPrice && p.priceCount > 1).length;
  const withDrops = allProducts.filter((p) => p.currentPrice < p.maxPrice && p.minPrice < p.maxPrice).length;

  const retailerCounts: Record<string, number> = {};
  for (const p of allProducts) {
    retailerCounts[p.retailer] = (retailerCounts[p.retailer] || 0) + 1;
  }

  // Top brands (extract first word or known brand)
  const brandCounts: Record<string, number> = {};
  for (const p of allProducts) {
    const brand = p.name.split(/\s+/)[0].toUpperCase();
    if (brand.length >= 2 && brand.length <= 20) {
      brandCounts[brand] = (brandCounts[brand] || 0) + 1;
    }
  }
  const topBrands = Object.entries(brandCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Best " + label + " Deals in Canada — " + month + " " + year,
    description: "Find the best " + label.toLowerCase() + " prices in Canada. Compare across " + retailers.join(" and ") + ".",
    dateModified: new Date().toISOString(),
    author: { "@type": "Organization", name: "TrackAura" },
    publisher: { "@type": "Organization", name: "TrackAura", url: "https://www.trackaura.com" },
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <nav style={{ display: "flex", gap: "0.5rem", fontSize: "0.8125rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <Link href="/" className="accent-link">Home</Link>
        <span style={{ color: "var(--text-secondary)" }}>/</span>
        <Link href="/products" className="accent-link">Products</Link>
        <span style={{ color: "var(--text-secondary)" }}>/</span>
        <span style={{ color: "var(--text-secondary)" }}>{"Best " + label}</span>
      </nav>

      {/* Hero + intro */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: "1.75rem", marginBottom: "0.75rem" }}>
          {icon + " Best " + label + " Deals in Canada — " + month + " " + year}
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem", lineHeight: 1.7, marginBottom: "1rem" }}>
          {"We\u2019re currently tracking " + allProducts.length.toLocaleString() + " " + label.toLowerCase() +
          " from " + retailers.join(" and ") + ", with prices updated every 4 hours. " +
          "Whether you\u2019re looking for a budget option or a premium pick, this page shows you exactly where prices stand right now across Canadian retailers."}
        </p>
      </div>

      {/* Market snapshot */}
      <div className="card" style={{ padding: "1.5rem", marginBottom: "2rem" }}>
        <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: "1.125rem", marginBottom: "1rem" }}>
          {label + " Price Snapshot — " + month + " " + year}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "1rem" }}>
          <StatBox label="Products Tracked" value={allProducts.length.toLocaleString()} />
          <StatBox label="Average Price" value={formatPrice(avgPrice)} />
          <StatBox label="Median Price" value={formatPrice(medianPrice)} />
          <StatBox label="Cheapest" value={formatPrice(lowestPrice)} accent />
          <StatBox label="Most Expensive" value={formatPrice(highestPrice)} />
          <StatBox label="At Lowest Price" value={atLowestCount.toString()} accent />
        </div>
      </div>

      {/* SEO article content */}
      <div style={{ marginBottom: "2rem", fontSize: "0.9375rem", color: "var(--text-secondary)", lineHeight: 1.8 }}>
        <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: "1.125rem", color: "var(--text-primary)", marginBottom: "0.75rem" }}>
          {"What\u2019s Happening with " + label + " Prices in Canada"}
        </h2>
        <p style={{ marginBottom: "1rem" }}>
          {"As of " + month + " " + year + ", the average " + label.toLowerCase() +
          " price across Canadian retailers is " + formatPrice(avgPrice) +
          " CAD, with options ranging from " + formatPrice(lowestPrice) + " to " + formatPrice(highestPrice) +
          ". The median price sits at " + formatPrice(medianPrice) +
          ", which gives you a better sense of what most people are actually paying."}
        </p>
        {atLowestCount > 0 && (
          <p style={{ marginBottom: "1rem" }}>
            {"Right now, " + atLowestCount + " " + label.toLowerCase() +
            (atLowestCount === 1 ? " is " : " are ") +
            "sitting at the lowest price we\u2019ve ever tracked \u2014 a good sign if you\u2019ve been waiting for a deal."}
          </p>
        )}
        {withDrops > 0 && (
          <p style={{ marginBottom: "1rem" }}>
            {"We\u2019ve recorded price drops on " + withDrops + " " + label.toLowerCase() +
            " since we started tracking. Prices in this category " +
            (withDrops > allProducts.length * 0.3
              ? "have been quite active, with frequent changes across retailers."
              : "tend to be fairly stable, so when a drop happens it\u2019s worth paying attention to.")}
          </p>
        )}
        {topBrands.length > 0 && (
          <p style={{ marginBottom: "1rem" }}>
            {"The most common brands we track in this category are " +
            topBrands.map((b) => b.name.charAt(0) + b.name.slice(1).toLowerCase()).join(", ") +
            ". " + topBrands[0].name.charAt(0) + topBrands[0].name.slice(1).toLowerCase() +
            " leads with " + topBrands[0].count + " products listed."}
          </p>
        )}
        {retailers.length > 1 && (
          <p style={{ marginBottom: "1rem" }}>
            {"Between retailers, " +
            Object.entries(retailerCounts)
              .map(([r, c]) => r + " carries " + c)
              .join(" and ") +
            " " + label.toLowerCase() +
            ". Comparing across both stores can save you anywhere from a few dollars to over $100 depending on the product."}
          </p>
        )}
      </div>

      {/* Product listings */}
      {cheapest.length > 0 && (
        <Section title={"Cheapest " + label + " Right Now"}>
          {cheapest.map((p) => (<ProductRow key={p.id} product={p} />))}
        </Section>
      )}

      {atLowest.length > 0 && (
        <Section title={"At Their Lowest Tracked Price"}>
          <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "0.75rem", padding: "0 1rem" }}>
            These products are currently at the lowest price we have ever recorded.
          </p>
          {atLowest.map((p) => (<ProductRow key={p.id} product={p} />))}
        </Section>
      )}

      {biggestDrops.length > 0 && (
        <Section title={"Biggest Price Drops"}>
          {biggestDrops.map((p) => (<ProductRow key={p.id} product={p} badge={"-" + (p as any).drop + "%"} />))}
        </Section>
      )}

      {buckets.map((bucket) =>
        bucket.items.length > 0 ? (
          <Section key={bucket.max} title={"Best " + label + " Under $" + bucket.max}>
            {bucket.items.map((p) => (<ProductRow key={p.id} product={p} />))}
          </Section>
        ) : null
      )}

      {/* Buying advice */}
      <div className="card" style={{ padding: "1.5rem", marginBottom: "2rem" }}>
        <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: "1.125rem", marginBottom: "0.75rem" }}>
          {"Tips for Buying " + label + " in Canada"}
        </h2>
        <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.8 }}>
          <p style={{ marginBottom: "0.75rem" }}>
            {"Always compare prices across retailers before buying. We\u2019ve seen the same product priced differently at Canada Computers and Newegg — sometimes by $20\u201350 or more."}
          </p>
          <p style={{ marginBottom: "0.75rem" }}>
            {"Check the price history chart on any product page to see if the current price is a genuine deal or if it\u2019s been lower before. A product \u201Con sale\u201D might still be above its historical low."}
          </p>
          <p style={{ marginBottom: "0.75rem" }}>
            {"Set a price alert on TrackAura for products you\u2019re watching. We\u2019ll email you when the price drops to your target."}
          </p>
          <p>
            {"Consider checking Amazon.ca as well \u2014 we include Amazon comparison links on every product page so you can quickly see if there\u2019s a better deal there."}
          </p>
        </div>
      </div>

      {/* How we track */}
      <div className="card" style={{ padding: "1.5rem", marginBottom: "2rem" }}>
        <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: "1rem", marginBottom: "0.75rem" }}>
          {"How We Track " + label + " Prices"}
        </h2>
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.7 }}>
          {"TrackAura automatically checks prices at " + retailers.join(" and ") +
          " every 4 hours. We record every price change so you can see the full history and buy at the right time. " +
          "All prices are in Canadian dollars (CAD). Amazon links may earn TrackAura a commission. " +
          "This page updates automatically as new data comes in \u2014 no manual curation."}
        </p>
      </div>

      <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
        <Link href={"/products?category=" + category} className="btn-primary" style={{ textDecoration: "none", display: "inline-block" }}>
          {"View All " + allProducts.length.toLocaleString() + " " + label}
        </Link>
      </div>
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ textAlign: "center", padding: "0.75rem" }}>
      <p style={{
        fontFamily: "'Sora', sans-serif",
        fontWeight: 700,
        fontSize: "1.25rem",
        color: accent ? "var(--accent)" : "var(--text-primary)",
        marginBottom: "0.25rem",
      }}>
        {value}
      </p>
      <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "2rem" }}>
      <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: "1.125rem", marginBottom: "0.75rem" }}>{title}</h2>
      <div className="card" style={{ padding: "0.5rem" }}>{children}</div>
    </div>
  );
}

function ProductRow({ product, badge }: { product: any; badge?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", gap: "0.75rem", flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <Link href={"/product/" + product.slug} style={{ fontSize: "0.875rem", color: "var(--text-primary)", textDecoration: "none", fontWeight: 500 }}>
          {product.name}
        </Link>
        <p style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", marginTop: 2 }}>{product.retailer}</p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {badge && (
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--accent)", background: "var(--accent-glow)", padding: "0.125rem 0.375rem", borderRadius: 4 }}>{badge}</span>
        )}
        <span className="price-tag" style={{ fontSize: "1rem" }}>{formatPrice(product.currentPrice)}</span>
        <ClickTracker
          href={getAmazonSearchUrl(product.name)}
          event="affiliate_click"
          label={product.name}
          retailer="Amazon"
          category={product.category}
          price={product.currentPrice}
          className="btn-amazon"
          style={{ textDecoration: "none", fontSize: "0.75rem", padding: "0.375rem 0.625rem" }}
          rel="nofollow"
        >
          Amazon
        </ClickTracker>
      </div>
    </div>
  );
}
