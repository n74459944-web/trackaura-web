import { Metadata } from "next";
import Link from "next/link";
import { getFilteredProducts } from "@/lib/data";
import { CATEGORY_LABELS, CATEGORY_ICONS, Product } from "@/types";
import { formatPrice, getRetailerAffiliateUrl } from "@/lib/utils";
import SearchBar from "@/components/SearchBar";

export const revalidate = 14400;

type PageProps = { searchParams: Promise<{ q?: string }> };

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = await searchParams;
  const query = q || "";
  return {
    title: query ? `"${query}" \u2014 Search Results | TrackAura` : "Search Products | TrackAura",
    description: query
      ? `Search results for "${query}" across Canadian electronics retailers. Compare prices at Canada Computers and Newegg Canada.`
      : "Search electronics products tracked across Canadian retailers.",
    alternates: { canonical: "https://www.trackaura.com/search" },
  };
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const query = (q || "").trim();

  // CHANGED: was getAllProducts() + JS filter (scanned 37K rows per query).
  // Now uses surgical SQL via getFilteredProducts. Multi-word AND search on
  // product name only.
  //
  // NOTE: This drops MPN/UPC matching from /search results. Use the dedicated
  // /mpn/[mpn] route for direct MPN lookups. To restore MPN/UPC search here,
  // add an FTS5 index on (name, mpn, upc) and a new searchProductsFull() helper.
  let results: Product[] = [];
  if (query.length >= 2) {
    const result = await getFilteredProducts({
      search: query,
      pageSize: 100,
      sort: "at-lowest", // popular + at-lowest first; closest match to old sort
    });
    results = result.products;
  }

  // Category breakdown of results
  const catCounts: Record<string, number> = {};
  for (const p of results) {
    catCounts[p.category] = (catCounts[p.category] || 0) + 1;
  }
  const topCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <nav style={{ display: "flex", gap: "0.5rem", fontSize: "0.8125rem", marginBottom: "1.5rem" }}>
        <Link href="/" className="accent-link">Home</Link>
        <span style={{ color: "var(--text-secondary)" }}>/</span>
        <span style={{ color: "var(--text-secondary)" }}>Search</span>
      </nav>

      <h1 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: "1.5rem", marginBottom: "1rem" }}>
        {query ? `Results for "${query}"` : "Search Products"}
      </h1>

      <div style={{ maxWidth: 560, marginBottom: "1.5rem" }}>
        <SearchBar large />
      </div>

      {query && (
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
          {results.length > 0
            ? `Found ${results.length} product${results.length === 1 ? "" : "s"} matching "${query}"`
            : `No products found for "${query}". Try a different search term.`}
        </p>
      )}

      {/* Category pills */}
      {topCats.length > 1 && (
        <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
          {topCats.map(([key, count]) => (
            <span key={key} className="filter-pill" style={{ fontSize: "0.75rem" }}>
              {(CATEGORY_ICONS[key] || "\uD83D\uDCE6") + " " + (CATEGORY_LABELS[key] || key) + " (" + count + ")"}
            </span>
          ))}
        </div>
      )}

      {/* Results */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {results.map((product) => {
          const hasDiscount = product.minPrice < product.maxPrice;
          const discountPct = hasDiscount
            ? Math.round(((product.maxPrice - product.currentPrice) / product.maxPrice) * 100)
            : 0;
          const isAtLowest = product.currentPrice <= product.minPrice && product.priceCount > 1;
          const retailerUrl = getRetailerAffiliateUrl(product);

          return (
            <div key={product.id} className="card" style={{
              padding: "1rem",
              display: "grid",
              gridTemplateColumns: product.imageUrl ? "56px 1fr auto" : "1fr auto",
              gap: "0.75rem",
              alignItems: "center",
            }}>
              {product.imageUrl && (
                <div style={{
                  width: 56, height: 56, background: "#fff", borderRadius: 6,
                  display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
                }}>
                  <img src={product.imageUrl} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} loading="lazy" />
                </div>
              )}

              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
                  <span className={product.retailer === "Canada Computers" ? "badge-cc" : "badge-newegg"} style={{
                    padding: "0.125rem 0.375rem", borderRadius: 999, fontSize: "0.625rem", fontWeight: 600,
                  }}>
                    {product.retailer === "Canada Computers" ? "CC" : "Newegg"}
                  </span>
                  <span style={{ fontSize: "0.6875rem", color: "var(--text-secondary)" }}>
                    {CATEGORY_LABELS[product.category] || product.category}
                  </span>
                </div>

                <Link href={"/product/" + product.slug} style={{
                  fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)", textDecoration: "none",
                  display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {product.shortName || product.name}
                </Link>

                {product.mpn && (
                  <p style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", marginTop: "0.125rem" }}>
                    {"MPN: " + product.mpn}
                  </p>
                )}
              </div>

              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p className="price-tag" style={{ fontSize: "1.125rem" }}>{formatPrice(product.currentPrice)}</p>
                {hasDiscount && discountPct > 0 && (
                  <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--accent)" }}>
                    {"-" + discountPct + "%"}
                  </span>
                )}
                {isAtLowest && (
                  <p style={{ fontSize: "0.625rem", color: "var(--accent)", fontWeight: 600 }}>{"\u25CF Lowest"}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* No query state */}
      {!query && (
        <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--text-secondary)" }}>
          <p style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>{"\uD83D\uDD0D"}</p>
          <p>Search by product name or brand</p>
          <p style={{ fontSize: "0.8125rem", marginTop: "0.25rem" }}>
            {"Try: RTX 5070, Sony WH-1000XM5, Corsair RAM"}
          </p>
        </div>
      )}
    </div>
  );
}
