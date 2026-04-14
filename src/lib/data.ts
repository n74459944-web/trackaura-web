import { Product, PricePoint, SiteStats } from "@/types";
import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const DATA_DIR = path.join(process.cwd(), "public", "data");

let _allProductsCache: Product[] | null = null;
let _lineageCache: LineageFile | null = null;

const rowToProduct = (row: any): Product => JSON.parse(row.data as string) as Product;

// Chunked fetch helper — Turso's mem_hrana_response cap trips on large result sets.
// Caller's SQL must NOT include LIMIT/OFFSET; this helper appends them.
async function fetchChunked(sql: string, baseArgs: unknown[] = []): Promise<Product[]> {
  const all: Product[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const res = await db.execute({
      sql: `${sql} LIMIT ? OFFSET ?`,
      args: [...baseArgs, pageSize, offset] as never,
    });
    const rows = res.rows.map(rowToProduct);
    all.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

export async function getAllProducts(): Promise<Product[]> {
  if (_allProductsCache) return _allProductsCache;
  _allProductsCache = await fetchChunked("SELECT data FROM products ORDER BY rowid");
  return _allProductsCache;
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const res = await db.execute({ sql: "SELECT data FROM products WHERE slug = ? LIMIT 1", args: [slug] });
  return res.rows.length ? rowToProduct(res.rows[0]) : undefined;
}

export async function getProductsByCategory(category: string): Promise<Product[]> {
  return fetchChunked("SELECT data FROM products WHERE category = ? ORDER BY rowid", [category]);
}

export async function getProductsByRetailer(retailer: string): Promise<Product[]> {
  return fetchChunked("SELECT data FROM products WHERE retailer = ? ORDER BY rowid", [retailer]);
}

export async function getPriceHistory(productId: number): Promise<PricePoint[]> {
  const res = await db.execute({
    sql: "SELECT ts AS date, price FROM price_history WHERE product_id = ? ORDER BY ts",
    args: [productId],
  });
  return res.rows.map((r: any) => ({ date: r.date as string, price: r.price as number })) as PricePoint[];
}

export async function searchProducts(query: string): Promise<Product[]> {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const res = await db.execute({
    sql: "SELECT data FROM products WHERE LOWER(name) LIKE ? LIMIT 50",
    args: [`%${q}%`],
  });
  return res.rows.map(rowToProduct);
}

export async function getDeals(): Promise<Product[]> {
  const res = await db.execute(
    `SELECT data FROM products WHERE minPrice < maxPrice AND maxPrice > 0
     ORDER BY (maxPrice - currentPrice) * 1.0 / maxPrice DESC LIMIT 12`
  );
  return res.rows.map(rowToProduct);
}

export function getStats(): SiteStats {
  const filePath = path.join(DATA_DIR, "stats.json");
  if (!fs.existsSync(filePath)) {
    return { totalProducts: 0, totalPricePoints: 0, retailers: [], categories: [],
      lastUpdated: new Date().toISOString(), productsByRetailer: {}, productsByCategory: {} };
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as SiteStats;
}

export interface PriceIndexDay { date: string; avg: number; median?: number; count: number; }
export interface PriceIndex {
  generated: string; basketSize?: number; basketDate?: string; overallPctChange?: number;
  overall: PriceIndexDay[];
  categories: Record<string, { trend: PriceIndexDay[]; pctChange: number } | PriceIndexDay[]>;
}

export function getPriceIndex(): PriceIndex | null {
  const filePath = path.join(DATA_DIR, "price-index.json");
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as PriceIndex;
}

export function formatPrice(price: number): string { return `$${price.toFixed(2)}`; }

export function getAmazonSearchUrl(productName: string): string {
  return `https://www.amazon.ca/s?k=${encodeURIComponent(productName)}&tag=trackaura00-20`;
}

// ---- Lineage ----
interface Generation { name: string; search: string; year: number; }
interface LineageLine { line: string; generations: Generation[]; }
interface LineageFile { gpu: LineageLine[]; cpu: LineageLine[]; }
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
  _lineageCache = JSON.parse(fs.readFileSync(filePath, "utf-8")) as LineageFile;
  return _lineageCache;
}

export async function resolveLineage(product: Product): Promise<ResolvedLineage | null> {
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
      const categoryProducts = await getProductsByCategory(product.category);
      const findCheapest = (search: string): Product | null => {
        const matches = categoryProducts
          .filter((p) => p.name.toLowerCase().includes(search))
          .sort((a, b) => a.currentPrice - b.currentPrice);
        return matches[0] || null;
      };
      return {
        line: line.line,
        previous: previousGen ? { gen: previousGen, product: findCheapest(previousGen.search) } : undefined,
        current: { gen },
        next: nextGen ? { gen: nextGen, product: findCheapest(nextGen.search) } : undefined,
      };
    }
  }
  return null;
}

export async function getRelatedProducts(product: Product, limit: number = 6): Promise<Product[]> {
  const products = await getProductsByCategory(product.category);
  return products
    .filter((p) => p.id !== product.id && p.currentPrice > 0)
    .sort((a, b) => {
      const aAtLowest = a.currentPrice <= a.minPrice && a.priceCount > 1 ? 1 : 0;
      const bAtLowest = b.currentPrice <= b.minPrice && b.priceCount > 1 ? 1 : 0;
      if (bAtLowest !== aAtLowest) return bAtLowest - aAtLowest;
      return b.priceCount - a.priceCount;
    })
    .slice(0, limit);
}

// ============================================================
// Server-side filtering for /products page
// Append the code below to the end of src/lib/data.ts
// ============================================================

export interface ProductFilters {
  category?: string;      // slug or "all"
  retailer?: string;      // retailer name or "all"
  search?: string;        // multi-word AND search on name
  minPrice?: number;
  maxPrice?: number;
  sort?: string;          // biggest-drop | at-lowest | price-asc | price-desc | newest | name
  page?: number;          // 1-indexed
  pageSize?: number;      // default 48
}

export interface FilteredProductsResult {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Quality filters — match the client-side logic that was in ProductsClient.
// These get AND'd into every query so bad-data rows never appear.
const QUALITY_WHERE = `
  length(name) >= 15
  AND instr(name, '{') = 0
  AND instr(name, '}') = 0
  AND currentPrice >= 5
  AND NOT (maxPrice > minPrice * 10 AND minPrice > 0)
`;

// priceCount and firstSeen aren't confirmed columns on `products` (they may
// live only inside the JSON blob), so we read them via json_extract. Slightly
// slower than a column reference but works whether they're columns or not.
const PRICE_COUNT_EXPR = "CAST(json_extract(data, '$.priceCount') AS INTEGER)";
const FIRST_SEEN_EXPR = "json_extract(data, '$.firstSeen')";

const SORT_EXPRESSIONS: Record<string, string> = {
  "biggest-drop":
    "CASE WHEN maxPrice > 0 AND maxPrice > minPrice " +
    "THEN (maxPrice - currentPrice) * 1.0 / maxPrice ELSE -1 END DESC",
  "at-lowest":
    `CASE WHEN currentPrice <= minPrice AND ${PRICE_COUNT_EXPR} > 1 THEN 0 ELSE 1 END ASC, ` +
    `${PRICE_COUNT_EXPR} DESC`,
  "price-asc":
    "CASE WHEN currentPrice < 1 THEN 2 ELSE 1 END ASC, currentPrice ASC",
  "price-desc": "currentPrice DESC",
  newest: `${FIRST_SEEN_EXPR} DESC`,
  name: "name ASC",
};

export async function getFilteredProducts(
  filters: ProductFilters,
): Promise<FilteredProductsResult> {
  const pageSize = filters.pageSize ?? 48;
  const page = Math.max(1, filters.page ?? 1);

  const whereClauses: string[] = [QUALITY_WHERE];
  const args: unknown[] = [];

  if (filters.category && filters.category !== "all") {
    whereClauses.push("category = ?");
    args.push(filters.category);
  }
  if (filters.retailer && filters.retailer !== "all") {
    whereClauses.push("retailer = ?");
    args.push(filters.retailer);
  }
  if (typeof filters.minPrice === "number" && !isNaN(filters.minPrice)) {
    whereClauses.push("currentPrice >= ?");
    args.push(filters.minPrice);
  }
  if (typeof filters.maxPrice === "number" && !isNaN(filters.maxPrice)) {
    whereClauses.push("currentPrice <= ?");
    args.push(filters.maxPrice);
  }

  // Multi-word AND search. Matches client behavior: every word must appear
  // somewhere in the product name, case-insensitive.
  if (filters.search && filters.search.trim()) {
    const words = filters.search
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0);
    for (const w of words) {
      whereClauses.push("LOWER(name) LIKE ?");
      args.push(`%${w}%`);
    }
  }

  const whereSQL = whereClauses.join(" AND ");
  const sortSQL =
    SORT_EXPRESSIONS[filters.sort || "biggest-drop"] ||
    SORT_EXPRESSIONS["biggest-drop"];

  // Count + page queries in parallel
  const countPromise = db.execute({
    sql: `SELECT COUNT(*) AS n FROM products WHERE ${whereSQL}`,
    args: args as never,
  });

  const pagePromise = db.execute({
    sql:
      `SELECT data FROM products WHERE ${whereSQL} ` +
      `ORDER BY ${sortSQL} LIMIT ? OFFSET ?`,
    args: [...args, pageSize, (page - 1) * pageSize] as never,
  });

  const [countRes, pageRes] = await Promise.all([countPromise, pagePromise]);

  const total = Number(countRes.rows[0].n) || 0;
  const products = pageRes.rows.map(rowToProduct);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return { products, total, page, pageSize, totalPages };
}
