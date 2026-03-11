import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAllProducts,
  getProductBySlug,
  getPriceHistory,
} from "@/lib/data";
import { formatPrice, getAmazonSearchUrl, getRetailerAffiliateUrl } from "@/lib/utils";
import { CATEGORY_LABELS } from "@/types";
import { Product } from "@/types";
import PriceChart from "@/components/PriceChart";
import ClickTracker from "@/components/ClickTracker";
import PriceAlert from "@/components/PriceAlert";
import PriceCompare from "@/components/PriceCompare";
import RelatedProducts from "@/components/RelatedProducts";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

// ---- Improved product matching ----

// Common filler words to ignore when matching
const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "your",
  "desktop", "laptop", "gaming", "computer", "processor", "graphics",
  "card", "memory", "module", "internal", "external", "solid", "state",
  "drive", "compatible", "support", "series", "edition", "version",
  "black", "white", "red", "blue", "green", "grey", "gray", "silver",
  "gold", "pink", "brown", "orange", "purple",
]);

// Known brand names to prioritize in matching
const BRANDS = [
  "samsung", "intel", "amd", "nvidia", "asus", "msi", "gigabyte",
  "corsair", "kingston", "crucial", "western", "seagate", "noctua",
  "logitech", "razer", "steelseries", "hyperx", "cooler master",
  "nzxt", "evga", "sapphire", "asrock", "biostar", "zotac",
  "pny", "patriot", "gskill", "g.skill", "team", "thermaltake",
  "be quiet", "fractal", "lian", "phanteks", "deepcool", "arctic",
  "acer", "dell", "lenovo", "benq", "viewsonic", "lg", "sony",
  "jbl", "sennheiser", "audio-technica", "shokz", "maxell",
  "tp-link", "netgear", "linksys", "dlink", "ubiquiti",
  "western digital", "wd", "sandisk", "hynix", "micron",
  "roccat", "redragon", "keychron", "ducky", "anne",
  "antec", "montech", "lga", "ryzen", "geforce", "radeon",
];

function extractBrand(name: string): string | null {
  const lower = name.toLowerCase();
  // Check multi-word brands first (longer match takes priority)
  const sorted = [...BRANDS].sort((a, b) => b.length - a.length);
  for (const brand of sorted) {
    if (lower.includes(brand)) return brand;
  }
  return null;
}

function extractKeyTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s.-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

// Extract model-like tokens: alphanumeric patterns (e.g., "9100", "RX9070", "DDR5", "i5-12400")
function extractModelTokens(name: string): string[] {
  const matches = name.match(/[a-zA-Z]*\d+[a-zA-Z0-9\-.]*/g) || [];
  return matches
    .map((m) => m.toLowerCase())
    .filter((m) => m.length >= 2);
}

function computeMatchScore(source: Product, candidate: Product): number {
  // Must be same category
  if (candidate.category !== source.category) return 0;

  // Must be different retailer
  if (candidate.retailer === source.retailer) return 0;

  // Must not be the same product
  if (candidate.id === source.id) return 0;

  const sourceBrand = extractBrand(source.name);
  const candidateBrand = extractBrand(candidate.name);

  // Brand must match if both have one
  if (sourceBrand && candidateBrand && sourceBrand !== candidateBrand) return 0;

  // Brand match bonus
  let score = 0;
  if (sourceBrand && candidateBrand && sourceBrand === candidateBrand) {
    score += 15;
  }

  // Model number matching (most important signal)
  const sourceModels = extractModelTokens(source.name);
  const candidateModels = extractModelTokens(candidate.name);
  let modelMatches = 0;
  for (const m of sourceModels) {
    if (candidateModels.some((cm) => cm === m || cm.includes(m) || m.includes(cm))) {
      modelMatches++;
    }
  }
  score += modelMatches * 10;

  // General keyword overlap
  const sourceTokens = extractKeyTokens(source.name);
  const candidateTokens = new Set(extractKeyTokens(candidate.name));
  let wordMatches = 0;
  for (const token of sourceTokens) {
    if (candidateTokens.has(token)) wordMatches++;
  }

  // Percentage of source keywords matched
  const overlapRatio = sourceTokens.length > 0 ? wordMatches / sourceTokens.length : 0;
  score += overlapRatio * 20;

  // Penalize large price differences (likely different products)
  const priceDiff = Math.abs(source.currentPrice - candidate.currentPrice);
  const avgPrice = (source.currentPrice + candidate.currentPrice) / 2;
  if (avgPrice > 0) {
    const priceRatio = priceDiff / avgPrice;
    if (priceRatio > 0.5) score -= 10; // >50% price difference is suspicious
    if (priceRatio > 1.0) score -= 20; // >100% price difference is very suspicious
  }

  return score;
}

function findSimilarProducts(product: Product, allProducts: Product[]): Product[] {
  const MINIMUM_SCORE = 25; // Must have brand + at least one model match

  const scored = allProducts
    .map((p) => ({ product: p, score: computeMatchScore(product, p) }))
    .filter((s) => s.score >= MINIMUM_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return scored.map((s) => s.product);
}

// ---- Page ----

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return { title: "Product Not Found" };

  const title = product.name + " Price History - " + product.retailer;
  const description = "Track the price of " + product.name + " at " + product.retailer + ". Current price: $" + product.currentPrice.toFixed(2) + " CAD. Lowest: $" + product.minPrice.toFixed(2) + ". Compare across Canadian retailers.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: "https://www.trackaura.com/product/" + slug,
    },
    alternates: {
      canonical: "https://www.trackaura.com/product/" + slug,
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const history = getPriceHistory(product.id);
  const isAtLowest = product.currentPrice <= product.minPrice && product.priceCount > 1;
  const hasRange = product.minPrice < product.maxPrice;
  const discountPercent = hasRange
    ? Math.round(((product.maxPrice - product.currentPrice) / product.maxPrice) * 100)
    : 0;

  const allProducts = getAllProducts();
  const similar = findSimilarProducts(product, allProducts);
  // Related products: same category, prefer same brand and similar price
  const related = (() => {
    const sameCat = allProducts.filter(
      (p) => p.id !== product.id && p.category === product.category
    );
    const getBrand = (name: string) => {
      const words = name.split(/\s+/);
      if (words[0] && words[0].length <= 3 && words[1]) return (words[0] + " " + words[1]).toLowerCase();
      return (words[0] || "").toLowerCase();
    };
    const productBrand = getBrand(product.name);
    const scored = sameCat.map((p) => {
      let score = 0;
      if (getBrand(p.name) === productBrand) score += 20;
      const priceDiff = Math.abs(p.currentPrice - product.currentPrice);
      const avgPrice = (p.currentPrice + product.currentPrice) / 2;
      if (avgPrice > 0) {
        const ratio = priceDiff / avgPrice;
        if (ratio < 0.2) score += 10;
        else if (ratio < 0.5) score += 5;
      }
      if (p.minPrice < p.maxPrice) score += 3;
      if (p.retailer !== product.retailer) score += 5;
      return { product: p, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const result: typeof allProducts = [];
    let sameBrandCount = 0;
    for (const s of scored) {
      if (result.length >= 6) break;
      const isSameBrand = getBrand(s.product.name) === productBrand;
      if (isSameBrand && sameBrandCount >= 3) continue;
      result.push(s.product);
      if (isSameBrand) sameBrandCount++;
    }
    return result;
  })();

  const retailerUrl = getRetailerAffiliateUrl(product);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    url: "https://www.trackaura.com/product/" + product.slug,
    description: "Price tracking for " + product.name + " at " + product.retailer,
    offers: {
      "@type": "Offer",
      price: product.currentPrice,
      priceCurrency: "CAD",
      availability: "https://schema.org/InStock",
      url: product.url,
      seller: {
        "@type": "Organization",
        name: product.retailer,
      },
      priceValidUntil: new Date(Date.now() + 86400000).toISOString().split("T")[0],
    },
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <nav style={{ display: "flex", gap: "0.5rem", fontSize: "0.8125rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <Link href="/" className="accent-link">Home</Link>
        <span style={{ color: "var(--text-secondary)" }}>/</span>
        <Link href="/products" className="accent-link">Products</Link>
        <span style={{ color: "var(--text-secondary)" }}>/</span>
        <Link href={"/products?category=" + product.category} className="accent-link">
          {CATEGORY_LABELS[product.category] || product.category}
        </Link>
        <span style={{ color: "var(--text-secondary)" }}>/</span>
        <span style={{ color: "var(--text-secondary)" }}>
          {product.name.length > 40 ? product.name.slice(0, 40) + "\u2026" : product.name}
        </span>
      </nav>

      <div className="card" style={{ padding: "2rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <span className={product.retailer === "Canada Computers" ? "badge-cc" : "badge-newegg"} style={{ padding: "0.25rem 0.625rem", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600, display: "inline-block", marginBottom: "0.75rem" }}>
              {product.retailer}
            </span>

            <h1 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: "1.5rem", lineHeight: 1.3, marginBottom: "1rem" }}>
              {product.name}
            </h1>

            <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
              <span className="price-tag" style={{ fontSize: "2rem" }}>{formatPrice(product.currentPrice)}</span>
              <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>CAD</span>
              {hasRange && discountPercent > 0 && (
                <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--accent)", background: "var(--accent-glow)", padding: "0.125rem 0.5rem", borderRadius: 4 }}>
                  {discountPercent}% below high
                </span>
              )}
            </div>

            {isAtLowest && (
              <p style={{ fontSize: "0.8125rem", color: "var(--accent)", fontWeight: 600, marginBottom: "0.75rem" }}>
                {"\u25CF Currently at the lowest tracked price"}
              </p>
            )}

            {hasRange && (
              <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "1rem", flexWrap: "wrap" }}>
                <span>Low: <strong style={{ color: "var(--accent)" }}>{formatPrice(product.minPrice)}</strong></span>
                <span>High: <strong style={{ color: "var(--danger)" }}>{formatPrice(product.maxPrice)}</strong></span>
                <span>{product.priceCount} price points</span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: 180, width: "100%", maxWidth: 220 }}>
            <ClickTracker href={retailerUrl} event={product.retailer === "Newegg Canada" ? "affiliate_click" : "retailer_click"} label={product.name} retailer={product.retailer} category={product.category} price={product.currentPrice} className="btn-primary" style={{ textAlign: "center", textDecoration: "none", display: "block" }}>
              {"View at " + product.retailer}
            </ClickTracker>
            <ClickTracker href={getAmazonSearchUrl(product.name)} event="affiliate_click" label={product.name} retailer="Amazon" category={product.category} price={product.currentPrice} className="btn-amazon" style={{ textAlign: "center", textDecoration: "none", display: "block" }} rel="nofollow">
              Compare on Amazon
            </ClickTracker>
          </div>

          <PriceAlert productSlug={product.slug} productName={product.name} currentPrice={product.currentPrice} retailer={product.retailer} />
        </div>
      </div>

      <div className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
        <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: "1rem", marginBottom: "1rem" }}>Price History</h2>
        <PriceChart data={history} currentPrice={product.currentPrice} minPrice={product.minPrice} maxPrice={product.maxPrice} />
        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.75rem", textAlign: "center" }}>
          {"Tracking since " + new Date(product.firstSeen).toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" }) + " \u00B7 Last updated " + new Date(product.lastUpdated).toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      <PriceCompare product={product} similar={similar} />

      <RelatedProducts products={related} />

      <div style={{ padding: "1rem", fontSize: "0.75rem", color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.6 }}>
        Prices are in Canadian dollars (CAD) and are scraped every 4 hours. Amazon and Newegg links may earn TrackAura a commission.
      </div>
    </div>
  );
}
