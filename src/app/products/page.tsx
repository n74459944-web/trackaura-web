import { Suspense } from "react";
import { Metadata } from "next";
import { getFilteredProducts, getStats } from "@/lib/data";
import { CATEGORY_LABELS } from "@/types";
import ProductsClient from "./ProductsClient";

export const revalidate = 14400; // 4 hours, matches scrape cycle

type PageProps = {
  searchParams: Promise<{
    category?: string;
    retailer?: string;
    q?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
    page?: string;
  }>;
};

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const p = await searchParams;
  const categoryLabel = p.category && p.category !== "all"
    ? CATEGORY_LABELS[p.category]
    : null;
  const title = categoryLabel ? `${categoryLabel} — All Products` : "All Products";
  return {
    title,
    description:
      "Browse and filter all tracked Canadian electronics products. Compare prices across Canada Computers, Newegg Canada, Vuugo, and Visions Electronics.",
  };
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const p = await searchParams;

  const filters = {
    category: p.category || "all",
    retailer: p.retailer || "all",
    search: p.q || "",
    minPrice: p.minPrice ? parseFloat(p.minPrice) : undefined,
    maxPrice: p.maxPrice ? parseFloat(p.maxPrice) : undefined,
    sort: p.sort || "biggest-drop",
    page: p.page ? parseInt(p.page, 10) : 1,
    pageSize: 48,
  };

  // Run filtered-products query and stats fetch in parallel
  const [result, stats] = await Promise.all([
    getFilteredProducts(filters),
    Promise.resolve(getStats()),
  ]);

  return (
    <Suspense
      fallback={
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "4rem 1.5rem", textAlign: "center", color: "var(--text-secondary)" }}>
          Loading products...
        </div>
      }
    >
      <ProductsClient
        products={result.products}
        total={result.total}
        page={result.page}
        totalPages={result.totalPages}
        filters={filters}
        stats={stats}
      />
    </Suspense>
  );
}
