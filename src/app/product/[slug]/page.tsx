import { Metadata } from "next";
import Link from "next/link";
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
import ProductInfo from "@/components/ProductInfo";
import PriceAlert from "@/components/PriceAlert";
import PriceCompare from "@/components/PriceCompare";
import RelatedProducts from "@/components/RelatedProducts";
import ProductLineage from "@/components/ProductLineage";

export const revalidate = 14400;
export const dynamicParams = true;

type PageProps = { params: Promise<{ slug: string }> };

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

// Related categories: what someone browsing this category might also want
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

// ---- Page ----

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return { title: "Product Not Found" };

  const title = product.name + " Price History - " + product.retailer;
  const description =
    "Track the price of " +
    product.name +
    " at " +
    product.retailer +
    ". Current price: $" +
    product.currentPrice.toFixed(2) +
    " CAD. Lowest: $" +
    product.minPrice.toFixed(2) +
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
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const history = getPriceHistory(product.id);
  const isAtLowest = product.currentPrice <= product.minPrice && product.priceCount > 1;
  const hasRange = product.minPrice < product.maxPrice;
  const discountPercent = hasRange
    ? Math.round(((product.maxPrice - product.currentPrice) / product.maxPrice) * 100)
    : 0;

  // Cross-retailer comparison: use canonical data (already in product.priceComparison)
  // Only scan category products if we need fuzzy matching
  const hasCanonicalMatch = product.priceComparison && product.priceComparison.length > 0;

  // Use category fast path — loads ~400 products instead of 6,400
  const categoryProducts = hasCanonicalMatch ? [] : getProductsByCategory(product.category);

  // If canonical match exists, pass empty similar array (PriceCompare will use priceComparison)
  // If no canonical match, find similar products from other retailers as fallback
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
          return name
            .toLowerCase()
            .replace(/[^a-z0-9\s.-]/g, " ")
            .split(/\s+/)
            .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
        }

        function extractModelTokens(name: string): string[] {
          const matches = name.match(/[a-zA-Z]*\d+[a-zA-Z0-9\-.]*/g) || [];
          return matches.map((m) => m.toLowerCase()).filter((m) => m.length >= 2);
        }

        function computeMatchScore(source: Product, candidate: Product): number {
          if (candidate.category !== source.category) return 0;
          const sourceIsLaptop =
            source.name.toLowerCase().includes("laptop") ||
            source.name.toLowerCase().includes("notebook");
          const candidateIsLaptop =
            candidate.name.toLowerCase().includes("laptop") ||
            candidate.name.toLowerCase().includes("notebook");
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
            if (candidateModels.some((cm) => cm === m || cm.includes(m) || m.includes(cm)))
              modelMatches++;
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

  // Related products from the same category — uses category fast path
  const related = getRelatedProducts(product, 6);

  // Lineage resolved server-side — returns at most 2 products, not 6,400
  const lineage = resolveLineage(product);

  const retailerUrl = getRetailerAffiliateUrl(product);
  const catLabel = CATEGORY_LABELS[product.category] || product.category;
  const catIcon = CATEGORY_ICONS[product.category] || "\uD83D\uDCE6";

  // Structured data for SEO
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      image: product.imageUrl || undefined,
      description: product.name + " — price tracked at " + product.retailer,
      brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
      ...(product.upc ? { gtin13: product.upc } : {}),
      offers: {
        "@type": "Offer",
        url: "https://www.trackaura.com/product/" + product.slug,
        priceCurrency: "CAD",
        price: product.currentPrice.toFixed(2),
        availability: "https://schema.org/InStock",
        seller: { "@type": "Organization", name: product.retailer },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://www.trackaura.com" },
        { "@type": "ListItem", position: 2, name: "Products", item: "https://www.trackaura.com/products" },
        {
          "@type": "ListItem",
          position: 3,
          name: catLabel,
          item: "https://www.trackaura.com/category/" + product.category,
        },
        { "@type": "ListItem", position: 4, name: product.name },
      ],
    },
  ];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <nav
        style={{
          display: "flex",
          gap: "0.5rem",
          fontSize: "0.8125rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <Link href="/" className="accent-link">
          Home
        </Link>
        <span style={{ color: "var(--text-secondary)" }}>/</span>
        <Link href="/products" className="accent-link">
          Products
        </Link>
        <span style={{ color: "var(--text-secondary)" }}>/</span>
        <Link href={"/category/" + product.category} className="accent-link">
          {CATEGORY_LABELS[product.category] || product.category}
        </Link>
        <span style={{ color: "var(--text-secondary)" }}>/</span>
        <span style={{ color: "var(--text-secondary)" }}>
          {product.name.length > 40 ? product.name.slice(0, 40) + "\u2026" : product.name}
        </span>
      </nav>

      <ProductInfo product={product} />
      <div className="card" style={{ padding: "2rem", marginBottom: "1.5rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div style={{ flex: 1, minWidth: 280 }}>
            <span
              className={product.retailer === "Canada Computers" ? "badge-cc" : "badge-newegg"}
              style={{
                padding: "0.25rem 0.625rem",
                borderRadius: 999,
                fontSize: "0.75rem",
                fontWeight: 600,
                display: "inline-block",
                marginBottom: "0.75rem",
              }}
            >
              {product.retailer}
            </span>

            <h1
              style={{
                fontFamily: "'Sora', sans-serif",
                fontWeight: 700,
                fontSize: "1.5rem",
                lineHeight: 1.3,
                marginBottom: "1rem",
              }}
            >
              {product.name}
            </h1>

            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "0.75rem",
                marginBottom: "0.5rem",
                flexWrap: "wrap",
              }}
            >
              <span className="price-tag" style={{ fontSize: "2rem" }}>
                {formatPrice(product.currentPrice)}
              </span>
              <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>CAD</span>
              {hasRange && discountPercent > 0 && (
                <span
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "var(--accent)",
                    background: "var(--accent-glow)",
                    padding: "0.125rem 0.5rem",
                    borderRadius: 4,
                  }}
                >
                  {discountPercent}% below high
                </span>
              )}
            </div>

            {isAtLowest && (
              <p
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--accent)",
                  fontWeight: 600,
                  marginBottom: "0.75rem",
                }}
              >
                {"\u25CF Currently at the lowest tracked price"}
              </p>
            )}

            {/* Deal quality indicator based on price vs average */}
            {!isAtLowest &&
              product.priceCount >= 5 &&
              (() => {
                const avg = (product.minPrice + product.maxPrice) / 2;
                const pctFromAvg = ((product.currentPrice - avg) / avg) * 100;
                if (pctFromAvg < -15)
                  return (
                    <p
                      style={{
                        fontSize: "0.8125rem",
                        color: "var(--accent)",
                        fontWeight: 600,
                        marginBottom: "0.75rem",
                      }}
                    >
                      {"🟢 Great price — " + Math.abs(Math.round(pctFromAvg)) + "% below average"}
                    </p>
                  );
                if (pctFromAvg < -5)
                  return (
                    <p
                      style={{
                        fontSize: "0.8125rem",
                        color: "var(--accent)",
                        fontWeight: 600,
                        marginBottom: "0.75rem",
                      }}
                    >
                      {"🟢 Good price — " + Math.abs(Math.round(pctFromAvg)) + "% below average"}
                    </p>
                  );
                if (pctFromAvg > 15)
                  return (
                    <p
                      style={{
                        fontSize: "0.8125rem",
                        color: "var(--danger)",
                        fontWeight: 600,
                        marginBottom: "0.75rem",
                      }}
                    >
                      {"🔴 Above average — consider waiting"}
                    </p>
                  );
                if (pctFromAvg > 5)
                  return (
                    <p
                      style={{
                        fontSize: "0.8125rem",
                        color: "var(--text-secondary)",
                        fontWeight: 600,
                        marginBottom: "0.75rem",
                      }}
                    >
                      {"🟡 Fair price — close to average"}
                    </p>
                  );
                return null;
              })()}

            {hasRange && (
              <div
                style={{
                  display: "flex",
                  gap: "1.5rem",
                  fontSize: "0.8125rem",
                  color: "var(--text-secondary)",
                  marginBottom: "1rem",
                  flexWrap: "wrap",
                }}
              >
                <span>
                  Low:{" "}
                  <strong style={{ color: "var(--accent)" }}>{formatPrice(product.minPrice)}</strong>
                </span>
                <span>
                  High:{" "}
                  <strong style={{ color: "var(--danger)" }}>{formatPrice(product.maxPrice)}</strong>
                </span>
                <span>{product.priceCount} price points</span>
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              minWidth: 180,
              width: "100%",
              maxWidth: 220,
            }}
          >
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
              {"View at " + product.retailer}
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

      <div className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
        <h2
          style={{
            fontFamily: "'Sora', sans-serif",
            fontWeight: 600,
            fontSize: "1rem",
            marginBottom: "1rem",
          }}
        >
          Price History
        </h2>
        <PriceChart
          data={history}
          currentPrice={product.currentPrice}
          minPrice={product.minPrice}
          maxPrice={product.maxPrice}
        />
        <p
          style={{
            fontSize: "0.75rem",
            color: "var(--text-secondary)",
            marginTop: "0.75rem",
            textAlign: "center",
          }}
        >
          {"Tracking since " +
            new Date(product.firstSeen).toLocaleDateString("en-CA", {
              month: "long",
              day: "numeric",
              year: "numeric",
            }) +
            " \u00B7 Last updated " +
            new Date(product.lastUpdated).toLocaleDateString("en-CA", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
        </p>
      </div>

      <PriceCompare product={product} similar={similar} />
      <ProductLineage product={product} lineage={lineage} />
      <RelatedProducts products={related} />

      {/* Link to buying guide */}
      <div
        className="card"
        style={{
          padding: "1.25rem 1.5rem",
          marginBottom: "1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div>
          <p
            style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 600,
              fontSize: "0.9375rem",
              marginBottom: "0.25rem",
            }}
          >
            {(CATEGORY_ICONS[product.category] || "\uD83D\uDCE6") +
              " Best " +
              (CATEGORY_LABELS[product.category] || product.category) +
              " Deals"}
          </p>
          <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
            {"See our full buying guide with budget, mid-range, and high-end picks."}
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
        <div className="card" style={{ padding: "1.25rem 1.5rem", marginBottom: "1.5rem" }}>
          <h2
            style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 600,
              fontSize: "0.9375rem",
              marginBottom: "0.75rem",
            }}
          >
            Related Categories
          </h2>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {(RELATED_CATEGORIES[product.category] || []).map((cat) => (
              <Link
                key={cat}
                href={"/category/" + cat}
                className="filter-pill"
                style={{
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.375rem",
                }}
              >
                <span>{CATEGORY_ICONS[cat] || "\uD83D\uDCE6"}</span>
                <span>{CATEGORY_LABELS[cat] || cat}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          padding: "1rem",
          fontSize: "0.75rem",
          color: "var(--text-secondary)",
          textAlign: "center",
          lineHeight: 1.6,
        }}
      >
        Prices are in Canadian dollars (CAD) and are scraped daily. Amazon and Newegg links may earn
        TrackAura a commission.
      </div>
    </div>
  );
}
