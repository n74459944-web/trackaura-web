import { Product, PricePoint, SiteStats } from "@/types";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "public", "data");

let _productCache: Product[] | null = null;
let _lineageCache: LineageFile | null = null;

export function getAllProducts(): Product[] {
  if (_productCache) return _productCache;
  const filePath = path.join(DATA_DIR, "products.json");
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8");
  _productCache = JSON.parse(raw) as Product[];
  return _productCache;
}

export function getProductBySlug(slug: string): Product | undefined {
  // Fast path: individual file
  const fastPath = path.join(DATA_DIR, "products", `${slug}.json`);
  if (fs.existsSync(fastPath)) {
    const raw = fs.readFileSync(fastPath, "utf-8");
    return JSON.parse(raw) as Product;
  }
  // Fallback: full scan
  const products = getAllProducts();
  return products.find((p) => p.slug === slug);
}

export function getProductsByCategory(category: string): Product[] {
  // Fast path: category index file
  const fastPath = path.join(DATA_DIR, "products", "_categories", `${category}.json`);
  if (fs.existsSync(fastPath)) {
    const raw = fs.readFileSync(fastPath, "utf-8");
    return JSON.parse(raw) as Product[];
  }
  // Fallback: full scan
  return getAllProducts().filter((p) => p.category === category);
}

export function getProductsByRetailer(retailer: string): Product[] {
  return getAllProducts().filter((p) => p.retailer === retailer);
}

export function getPriceHistory(productId: number): PricePoint[] {
  const filePath = path.join(DATA_DIR, "history", `${productId}.json`);
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as PricePoint[];
}

export function getStats(): SiteStats {
  const filePath = path.join(DATA_DIR, "stats.json");
  if (!fs.existsSync(filePath)) {
    return {
      totalProducts: 0,
      totalPricePoints: 0,
      retailers: [],
      categories: [],
      lastUpdated: new Date().toISOString(),
      productsByRetailer: {},
      productsByCategory: {},
    };
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as SiteStats;
}

export interface PriceIndexDay {
  date: string;
  avg: number;
  median?: number;
  count: number;
}

export interface PriceIndex {
  generated: string;
  basketSize?: number;
  basketDate?: string;
  overallPctChange?: number;
  overall: PriceIndexDay[];
  categories: Record<string, { trend: PriceIndexDay[]; pctChange: number } | PriceIndexDay[]>;
}

export function getPriceIndex(): PriceIndex | null {
  const filePath = path.join(DATA_DIR, "price-index.json");
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as PriceIndex;
}

export function searchProducts(query: string): Product[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const products = getAllProducts();
  return products
    .filter((p) => p.name.toLowerCase().includes(q))
    .slice(0, 50);
}

export function getDeals(): Product[] {
  const products = getAllProducts();
  return products
    .filter((p) => p.minPrice < p.maxPrice)
    .sort((a, b) => {
      const aDiscount = (a.maxPrice - a.currentPrice) / a.maxPrice;
      const bDiscount = (b.maxPrice - b.currentPrice) / b.maxPrice;
      return bDiscount - aDiscount;
    })
    .slice(0, 12);
}

export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

export function getAmazonSearchUrl(productName: string): string {
  const query = encodeURIComponent(productName);
  return `https://www.amazon.ca/s?k=${query}&tag=trackaura00-20`;
}

// ---- Lineage ----

interface Generation {
  name: string;
  search: string;
  year: number;
}

interface LineageLine {
  line: string;
  generations: Generation[];
}

interface LineageFile {
  gpu: LineageLine[];
  cpu: LineageLine[];
}

export interface ResolvedLineage {
  line: string;
  previous?: { gen: Generation; product: Product | null };
  current: { gen: Generation };
  next?: { gen: Generation; product: Product | null };
}

function getLineageFile(): LineageFile | null {
  if (_lineageCache) return _lineageCache;
  const filePath = path.join(DATA_DIR, "product-lineage.json");
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  _lineageCache = JSON.parse(raw) as LineageFile;
  return _lineageCache;
}

/**
 * Resolve lineage for a product on the server.
 * Returns at most 2 related products (prev, next) instead of the full catalog.
 * Uses category fast path — never loads all 6,400 products.
 */
export function resolveLineage(product: Product): ResolvedLineage | null {
  const file = getLineageFile();
  if (!file) return null;

  const nameLower = product.name.toLowerCase();
  const lines = [...(file.gpu || []), ...(file.cpu || [])];

  for (const line of lines) {
    for (let i = 0; i < line.generations.length; i++) {
      const gen = line.generations[i];
      if (!nameLower.includes(gen.search)) continue;

      const previousGen = i > 0 ? line.generations[i - 1] : undefined;
      const nextGen = i < line.generations.length - 1 ? line.generations[i + 1] : undefined;

      // Load only this category — not all products
      const categoryProducts = getProductsByCategory(product.category);

      const findCheapest = (search: string): Product | null => {
        const matches = categoryProducts
          .filter((p) => p.name.toLowerCase().includes(search))
          .sort((a, b) => a.currentPrice - b.currentPrice);
        return matches[0] || null;
      };

      return {
        line: line.line,
        previous: previousGen
          ? { gen: previousGen, product: findCheapest(previousGen.search) }
          : undefined,
        current: { gen },
        next: nextGen
          ? { gen: nextGen, product: findCheapest(nextGen.search) }
          : undefined,
      };
    }
  }

  return null;
}

export function getRelatedProducts(product: Product, limit: number = 6): Product[] {
  return getProductsByCategory(product.category)
    .filter((p) => p.id !== product.id && p.currentPrice > 0)
    .sort((a, b) => {
      const aAtLowest = a.currentPrice <= a.minPrice && a.priceCount > 1 ? 1 : 0;
      const bAtLowest = b.currentPrice <= b.minPrice && b.priceCount > 1 ? 1 : 0;
      if (bAtLowest !== aAtLowest) return bAtLowest - aAtLowest;
      return b.priceCount - a.priceCount;
    })
    .slice(0, limit);
}
