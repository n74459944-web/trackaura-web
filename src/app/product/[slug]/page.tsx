import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  getProductBySlug,
  getProductsByCategory,
  getPriceHistory,
  getRelatedProducts,
  resolveLineage,
} from "@/lib/data";
import { formatPrice, getAmazonSearchUrl, getRetailerAffiliateUrl } from "@/lib/utils";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/types";
import { Product } from "@/types";
import PriceChart from "@/components/PriceChart";
import ClickTracker from "@/components/ClickTracker";
import PriceAlert from "@/components/PriceAlert";
import PriceCompare from "@/components/PriceCompare";
import RelatedProducts from "@/components/RelatedProducts";
import ProductLineage from "@/components/ProductLineage";

export const revalidate = 14400;
export const dynamicParams = true;

type PageProps = { params: Promise<{ slug: string }> };

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

const RELATED_CATEGORIES: Record<string, string[]> = {
  gpus: ["cpus", "power-supplies", "monitors", "cases", "motherboards"],
  cpus: ["gpus", "motherboards", "coolers", "ram"],
  monitors: ["gpus", "keyboards", "mice", "webcams"],
  ssds: ["ram", "motherboards", "external-storage", "cases"],
  ram: ["cpus", "motherboards", "ssds"],
  keyboards: ["mice", "monitors", "headphones"],
  mice: ["keyboards", "monitors", "headphones"],
  laptops: ["monitors", "keyboards", "mice", "external-storage", "headphones"],
  motherboards: ["cpus", "ram", "ssds", "gpus", "cases"],
  "power-supplies": ["gpus", "cases", "motherboards"],
  cases: ["power-supplies", "motherboards", "coolers", "gpus"],
  coolers: ["cpus", "motherboards", "cases"],
  headphones: ["speakers", "webcams", "keyboards"],
  speakers: ["headphones", "monitors"],
  routers: ["webcams", "external-storage"],
  webcams: ["monitors", "headphones", "routers"],
  "external-storage": ["ssds", "laptops"],
};

function extractBrand(name: string): string | null {
  const lower = name.toLowerCase();
  const sorted = [...BRANDS].sort((a, b) => b.length - a.length);
  for (const brand of sorted) {
    if (lower.includes(brand)) return brand;
  }
  return null;
}

// Compute median of a number array
function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product Not Found" };

  const title = product.name + " Price History - " + product.retailer;
  const description =
    "Track the price of " + product.name + " at " + product.retailer +
    ". Current price: $" + product.currentPrice.toFixed(2) +
    " CAD. Lowest: $" + product.minPrice.toFixed(2) +
    ". Compare across Canadian retailers.";

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
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const history = await getPriceHistory(product.id);
  const isAtLowest = product.currentPrice <= product.minPrice && product.priceCount > 1;
  const hasRange = product.minPrice < product.maxPrice;

  // 30-day median calculation
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentPrices = history
    .filter((h) => new Date(h.date).getTime() >= thirtyDaysAgo)
    .map((h) => h.price);
  const thirtyDayMedian = recentPrices.length >= 2 ? median(recentPrices) : null;
  const medianDelta = thirtyDayMedian
    ? ((product.currentPrice - thirtyDayMedian) / thirtyDayMedian) * 100
    : null;

  const hasCanonicalMatch = product.priceComparison && product.priceComparison.length > 0;
  const categoryProducts = hasCanonicalMatch ? [] : await getProductsByCategory(product.category);

  const similar = hasCanonicalMatch
    ? []
    : (() => {
        const STOP_WORDS = new Set([
          "the", "and", "for", "with", "from", "that", "this", "your",
          "desktop", "laptop", "gaming", "computer", "processor", "graphics",
          "card", "memory", "module", "internal", "external", "solid", "state",
          "drive", "compatible", "support", "series", "edition", "version",
          "black", "white", "red", "blue", "green", "grey", "gray", "silver",
          "gold", "pink", "brown", "orange", "purple",
        ]);

        function extractKeyTokens(name: string): string[] {
          return name.toLowerCase().replace(/[^a-z0-9\s.-]/g, " ")
            .split(/\s+/).filter((w) => w.length > 1 && !STOP_WORDS.has(w));
        }
        function extractModelTokens(name: string): string[] {
          const matches = name.match(/[a-zA-Z]*\d+[a-zA-Z0-9\-.]*/g) || [];
          return matches.map((m) => m.toLowerCase()).filter((m) => m.length >= 2);
        }
        function computeMatchScore(source: Product, candidate: Product): number {
          if (candidate.category !== source.category) return 0;
          const sourceIsLaptop = source.name.toLowerCase().includes("laptop") || source.name.toLowerCase().includes("notebook");
          const candidateIsLaptop = candidate.name.toLowerCase().includes("laptop") || candidate.name.toLowerCase().includes("notebook");
          if (sourceIsLaptop !== candidateIsLaptop) return 0;
          if (candidate.retailer === source.retailer) return 0;
          if (candidate.id === source.id) return 0;
          const sourceBrand = extractBrand(source.name);
          const candidateBrand = extractBrand(candidate.name);
          if (sourceBrand && candidateBrand && sourceBrand !== candidateBrand) return 0;
          let score = 0;
          if (sourceBrand && candidateBrand && sourceBrand === candidateBrand) score += 15;
          const sourceModels = extractModelTokens(source.name);
          const candidateModels = extractModelTokens(candidate.name);
          let modelMatches = 0;
          for (const m of sourceModels) {
            if (candidateModels.some((cm) => cm === m || cm.includes(m) || m.includes(cm))) modelMatches++;
          }
          score += modelMatches * 10;
          const sourceTokens = extractKeyTokens(source.name);
          const candidateTokens = extractKeyTokens(candidate.name);
          let wordMatches = 0;
          for (const w of sourceTokens) {
            if (candidateTokens.includes(w)) wordMatches++;
          }
          score += wordMatches * 3;
          return score;
        }

        return categoryProducts
          .filter((p) => p.retailer !== product.retailer)
          .map((p) => ({ product: p, score: computeMatchScore(product, p) }))
          .filter((m) => m.score >= 20)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
          .map((m) => m.product);
      })();

  const related = await getRelatedProducts(product, 6);
  const lineage = await resolveLineage(product);
  const retailerUrl = getRetailerAffiliateUrl(product);
  const catLabel = CATEGORY_LABELS[product.category] || product.category;
  const catIcon = CATEGORY_ICONS[product.category] || "📦";
  const brand = extractBrand(product.name);

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description:
        "Price history and current price for " + product.name +
        " at " + product.retailer +
        ". Current: $" + product.currentPrice.toFixed(2) +
        " CAD. Lowest tracked: $" + product.minPrice.toFixed(2) +
        ". Highest tracked: $" + product.maxPrice.toFixed(2) +
        ". Compare prices across Canadian retailers on TrackAura.",
      image: product.imageUrl || undefined,
      sku: String(product.id),
      brand: brand ? { "@type": "Brand", name: brand } : undefined,
      offers: {
        "@type": "Offer",
        price: product.currentPrice,
        priceCurrency: "CAD",
        availability: "https://schema.org/InStock",
        url: "https://www.trackaura.com/product/" + slug,
        seller: { "@type": "Organization", name: product.retailer },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://www.trackaura.com" },
        { "@type": "ListItem", position: 2, name: catLabel, item: "https://www.trackaura.com/category/" + product.category },
        { "@type": "ListItem", position: 3, name: product.name },
      ],
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Breadcrumb */}
      <nav className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
        <Link href="/" className="accent-link">Home</Link>
        <span className="mx-2">/</span>
        <Link href={"/category/" + product.category} className="accent-link">
          {catIcon} {catLabel}
        </Link>
        <span className="mx-2">/</span>
        <span className="truncate">{product.name}</span>
      </nav>

      {/* HERO: image + price + chart side by side */}
      <div className="card p-6 mb-6 animate-in">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* LEFT: Square image */}
          <div className="flex items-center justify-center">
            <div
              className="relative w-full aspect-square rounded-xl overflow-hidden"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
            >
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 500px"
                  className="object-contain p-6"
                  priority
                />
              ) : (
                <div className="flex items-center justify-center h-full text-6xl">
                  {catIcon}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Title, price, delta, chart */}
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={product.retailer === "Canada Computers" ? "badge-cc" : "badge-newegg"}
                  style={{ padding: "0.1875rem 0.5rem", borderRadius: 999, fontSize: "0.6875rem", fontWeight: 600 }}
                >
                  {product.retailer}
                </span>
                {brand && (
                  <span className="text-xs uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                    {brand}
                  </span>
                )}
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold leading-tight mb-1">
                {product.name}
              </h1>
            </div>

            {/* Price block */}
            <div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="price-tag" style={{ fontSize: "2.5rem", lineHeight: 1 }}>
                  {formatPrice(product.currentPrice)}
                </span>
                {medianDelta !== null && (
                  <span
                    className="text-sm font-semibold px-2 py-1 rounded"
                    style={{
                      color: medianDelta < 0 ? "var(--accent)" : medianDelta > 0 ? "var(--danger)" : "var(--text-secondary)",
                      background: medianDelta < 0 ? "var(--accent-glow)" : medianDelta > 0 ? "rgba(239,68,68,0.15)" : "transparent",
                    }}
                  >
                    {medianDelta < 0 ? "▼" : medianDelta > 0 ? "▲" : "="} {Math.abs(medianDelta).toFixed(1)}% vs 30-day median
                  </span>
                )}
              </div>
              {isAtLowest && (
                <p className="text-sm font-semibold mt-2" style={{ color: "var(--accent)" }}>
                  🔥 Lowest price we've tracked
                </p>
              )}
              {hasRange && (
                <div className="flex gap-4 text-xs mt-3 flex-wrap" style={{ color: "var(--text-secondary)" }}>
                  <span>Low: <strong style={{ color: "var(--accent)" }}>{formatPrice(product.minPrice)}</strong></span>
                  <span>High: <strong style={{ color: "var(--danger)" }}>{formatPrice(product.maxPrice)}</strong></span>
                  <span>{product.priceCount} data points</span>
                </div>
              )}
            </div>

            {/* Inline mini chart */}
            {history.length > 1 && (
              <div className="rounded-lg p-3" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <PriceChart
                  data={history}
                  currentPrice={product.currentPrice}
                  minPrice={product.minPrice}
                  maxPrice={product.maxPrice}
                />
              </div>
            )}

            {/* CTAs */}
            <div className="flex flex-col gap-2">
              <ClickTracker
                href={retailerUrl}
                event={product.retailer === "Newegg Canada" ? "affiliate_click" : "retailer_click"}
                label={product.name}
                retailer={product.retailer}
                category={product.category}
                price={product.currentPrice}
                className="btn-primary"
                style={{ textAlign: "center", textDecoration: "none", display: "block" }}
              >
                Buy at {product.retailer} →
              </ClickTracker>
              <ClickTracker
                href={getAmazonSearchUrl(product.name)}
                event="affiliate_click"
                label={product.name}
                retailer="Amazon"
                category={product.category}
                price={product.currentPrice}
                className="btn-amazon"
                style={{ textAlign: "center", textDecoration: "none", display: "block" }}
                rel="nofollow"
              >
                Compare on Amazon
              </ClickTracker>
            </div>

            <PriceAlert
              productSlug={product.slug}
              productName={product.name}
              currentPrice={product.currentPrice}
              retailer={product.retailer}
            />
          </div>
        </div>
      </div>

      {/* Where to buy */}
      <PriceCompare product={product} similar={similar} />

      {/* Family tree */}
      <ProductLineage product={product} lineage={lineage} />

      {/* Related products */}
      <RelatedProducts products={related} />

      {/* Buying guide link */}
      <div className="card p-5 mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="font-semibold text-base mb-1" style={{ fontFamily: "'Sora', sans-serif" }}>
            {catIcon} Best {catLabel} Deals
          </p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            See our full buying guide with budget, mid-range, and high-end picks.
          </p>
        </div>
        <Link
          href={"/best/" + product.category}
          className="btn-secondary"
          style={{ textDecoration: "none", fontSize: "0.8125rem", whiteSpace: "nowrap" }}
        >
          View Buying Guide
        </Link>
      </div>

      {/* Related categories */}
      {(RELATED_CATEGORIES[product.category] || []).length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="text-base font-semibold mb-3" style={{ fontFamily: "'Sora', sans-serif" }}>
            Related Categories
          </h2>
          <div className="flex gap-2 flex-wrap">
            {(RELATED_CATEGORIES[product.category] || []).map((cat) => (
              <Link
                key={cat}
                href={"/category/" + cat}
                className="filter-pill"
                style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.375rem" }}
              >
                <span>{CATEGORY_ICONS[cat] || "📦"}</span>
                <span>{CATEGORY_LABELS[cat] || cat}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-center p-4 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        Prices are in Canadian dollars (CAD) and are scraped daily. Amazon and Newegg links may earn TrackAura a commission.
      </div>
    </div>
  );
}
