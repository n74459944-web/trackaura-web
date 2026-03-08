import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllProducts } from "@/lib/data";
import { formatPrice, getAmazonSearchUrl } from "@/lib/utils";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/types";

const PRICE_RANGES: Record<string, number[]> = {
  gpus: [300, 500, 800, 1200],
  headphones: [25, 50, 100, 200],
  ssds: [50, 100, 150, 250],
  monitors: [200, 400, 700, 1200],
  keyboards: [30, 75, 150, 300],
  mice: [20, 50, 100, 200],
  laptops: [500, 800, 1200, 2000],
};

export function generateStaticParams() {
  return Object.keys(CATEGORY_LABELS)
    .filter((k) => k !== "other")
    .map((category) => ({ category }));
}

type PageProps = { params: Promise<{ category: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  const label = CATEGORY_LABELS[category];
  if (!label) return { title: "Not Found" };

  return {
    title: "Best " + label + " Deals in Canada " + new Date().getFullYear(),
    description: "Find the best " + label.toLowerCase() + " prices in Canada. Compare prices across Canada Computers and Newegg. Updated every 4 hours with real price tracking data.",
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

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <nav style={{ display: "flex", gap: "0.5rem", fontSize: "0.8125rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <Link href="/" className="accent-link">Home</Link>
        <span style={{ color: "var(--text-secondary)" }}>/</span>
        <Link href="/products" className="accent-link">Products</Link>
        <span style={{ color: "var(--text-secondary)" }}>/</span>
        <span style={{ color: "var(--text-secondary)" }}>{"Best " + label}</span>
      </nav>

      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: "1.75rem", marginBottom: "0.75rem" }}>
          {icon + " Best " + label + " Deals in Canada " + year}
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem", lineHeight: 1.7 }}>
          {"We track " + allProducts.length + " " + label.toLowerCase() + " across " + retailers.join(" and ") + ", updated every 4 hours. Below are the best deals, lowest prices, and biggest price drops right now."}
        </p>
      </div>

      {cheapest.length > 0 && (
        <Section title={"Cheapest " + label + " Right Now"}>
          {cheapest.map((p) => (<ProductRow key={p.id} product={p} />))}
        </Section>
      )}

      {atLowest.length > 0 && (
        <Section title={"At Their Lowest Tracked Price"}>
          <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
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

      <div style={{ marginTop: "2rem", padding: "1.5rem", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12 }}>
        <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: "1rem", marginBottom: "0.75rem" }}>
          {"How We Track " + label + " Prices"}
        </h2>
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.7 }}>
          {"TrackAura automatically checks prices at " + retailers.join(" and ") + " every 4 hours. We record every price change so you can see the full history and buy at the right time. All prices are in Canadian dollars (CAD). Amazon links may earn TrackAura a commission."}
        </p>
      </div>

      <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
        <Link href={"/products?category=" + category} className="btn-primary" style={{ textDecoration: "none", display: "inline-block" }}>
          {"View All " + allProducts.length + " " + label}
        </Link>
      </div>
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
        <a href={getAmazonSearchUrl(product.name)} target="_blank" rel="noopener noreferrer nofollow" className="btn-amazon" style={{ textDecoration: "none", fontSize: "0.75rem", padding: "0.375rem 0.625rem" }}>Amazon</a>
      </div>
    </div>
  );
}
