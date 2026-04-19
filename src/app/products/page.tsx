import { Suspense } from 'react';
import type { Metadata } from 'next';
import { CATEGORY_LABELS } from '@/types';
import { getFilteredProducts } from '@/lib/queries/products';
import { getHomeStats } from '@/lib/queries/home';
import ProductsClient from './ProductsClient';

// 15 minutes — aligns with the homepage. Sort/filter combinations are
// many, so per-page ISR would blow the cache; shorter revalidation keeps
// every path fresh without a full rebuild.
export const revalidate = 900;

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
  const categoryLabel =
    p.category && p.category !== 'all' ? CATEGORY_LABELS[p.category] : null;
  const title = categoryLabel
    ? `${categoryLabel} — All Products`
    : 'All Products';
  return {
    title,
    description:
      'Browse and filter all tracked Canadian electronics products. Compare prices across Canada Computers, Newegg Canada, Vuugo, and Visions Electronics.',
  };
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const p = await searchParams;

  const filters = {
    category: p.category || 'all',
    retailer: p.retailer || 'all',
    search: p.q || '',
    minPrice: p.minPrice ? parseFloat(p.minPrice) : undefined,
    maxPrice: p.maxPrice ? parseFloat(p.maxPrice) : undefined,
    sort: p.sort || 'biggest-drop',
    page: p.page ? parseInt(p.page, 10) : 1,
    pageSize: 48,
  };

  const [result, homeStats] = await Promise.all([
    getFilteredProducts(filters),
    getHomeStats(),
  ]);

  // ProductsClient expects the legacy SiteStats shape { totalProducts,
  // retailers: string[], ... }. We adapt from HomeStats here so the
  // client stays untouched.
  const stats = {
    totalProducts: homeStats.totalProducts,
    totalRetailers: homeStats.totalRetailers,
    categoriesTracked: homeStats.categoriesTracked,
    // Legacy fields some clients/types expect. ProductsClient only uses
    // stats.retailers (for the retailer filter dropdown) and
    // stats.totalProducts (for the page header stat line).
    retailers: [
      'Canada Computers',
      'Newegg Canada',
      'Vuugo',
      'Visions Electronics',
    ],
    categories: {},
    lastUpdated: new Date().toISOString(),
  };

  return (
    <Suspense
      fallback={
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '4rem 1.5rem',
            textAlign: 'center',
            color: 'var(--text-secondary)',
          }}
        >
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        stats={stats as any}
      />
    </Suspense>
  );
}
