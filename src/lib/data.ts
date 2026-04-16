import { Product, PricePoint, SiteStats } from "@/types";
import { cache } from "react";
import fs from "fs";
import path from "path";
import { pool } from "./db";

const DATA_DIR = path.join(process.cwd(), "public", "data");

let _lineageCache: LineageFile | null = null;

// ============================================================
// Row → Product mapping
// ============================================================
// Postgres returns snake_case columns; Product uses camelCase.
// pg also returns NUMERIC columns as strings (to preserve precision)
// and TIMESTAMPTZ columns as Date objects. We normalize both here.
//
// If the Product type has fields not listed below, add them here —
// a missing field here means the value on Product will be undefined
// at runtime even if TypeScript doesn't complain (the `as Product` cast).
// ============================================================

function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toISOString(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function rowToProduct(row: any): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    retailer: row.retailer,
    url: row.url ?? undefined,
    category: row.category,
    sourceCategory: row.source_category ?? undefined,
    brand: row.brand ?? undefined,
    modelKey: row.model_key ?? undefined,
    description: row.description ?? undefined,
    specs: row.specs ?? undefined,
    imageUrl: row.image_url ?? undefined,
    matchGroup: row.match_group ?? undefined,
    canonicalId: row.canonical_id ?? undefined,
    isOpenbox: Boolean(row.is_openbox),
    firstSeen: toISOString(row.first_seen),
    lastSeen: toISOString(row.last_seen),
    currentPrice: toNumber(row.current_price),
    minPrice: toNumber(row.min_price),
    maxPrice: toNumber(row.max_price),
    priceCount: row.price_count ?? 0,
    lastUpdated: toISOString(row.last_updated),
  } as Product;
}

// All columns we need for the full Product shape. Used by most SELECTs.
const PRODUCT_COLUMNS = `
  id, slug, name, retailer, url, category, source_category,
  brand, model_key, description, specs, image_url,
  match_group, canonical_id, is_openbox,
  first_seen, last_seen,
  current_price, min_price, max_price, price_count, last_updated
`;

// ============================================================
// Primary reads — wrapped in React.cache() for per-request dedupe.
// Cross-request caching is Vercel's job (via `revalidate`).
// ============================================================

export const getAllProducts = cache(async (): Promise<Product[]> => {
  // Full-catalog fetch is expensive (~20MB wire, ~40K rows). Prefer
  // getProductsByCategory / getFilteredProducts where possible.
  const res = await pool.query(
    `SELECT ${PRODUCT_COLUMNS} FROM products ORDER BY id`
  );
  return res.rows.map(rowToProduct);
});

export const getProductBySlug = cache(async (slug: string): Promise<Product | undefined> => {
  const res = await pool.query(
    `SELECT ${PRODUCT_COLUMNS} FROM products WHERE slug = $1 LIMIT 1`,
    [slug]
  );
  return res.rows.length ? rowToProduct(res.rows[0]) : undefined;
});

export const getProductsByCategory = cache(async (category: string): Promise<Product[]> => {
  const res = await pool.query(
    `SELECT ${PRODUCT_COLUMNS} FROM products WHERE category = $1 ORDER BY id`,
    [category]
  );
  return res.rows.map(rowToProduct);
});

export const getProductsByRetailer = cache(async (retailer: string): Promise<Product[]> => {
  const res = await pool.query(
    `SELECT ${PRODUCT_COLUMNS} FROM products WHERE retailer = $1 ORDER BY id`,
    [retailer]
  );
  return res.rows.map(rowToProduct);
});

export const getPriceHistory = cache(async (productId: number): Promise<PricePoint[]> => {
  const res = await pool.query(
    `SELECT timestamp, price FROM price_points WHERE product_id = $1 ORDER BY timestamp`,
    [productId]
  );
  return res.rows.map((r: any) => ({
    date: toISOString(r.timestamp) ?? "",
    price: toNumber(r.price),
  })) as PricePoint[];
});

// ============================================================
// Cheap aggregate helpers
// ============================================================

export const getCategoryCount = cache(async (category: string): Promise<number> => {
  const res = await pool.query(
    `SELECT COUNT(*)::int AS n FROM products WHERE category = $1`,
    [category]
  );
  return Number(res.rows[0]?.n) || 0;
});

export const getCategoryTopBrands = cache(async (category: string, limit: number = 6): Promise<string[]> => {
  const res = await pool.query(
    `SELECT brand, COUNT(*)::int AS n
     FROM products
     WHERE category = $1 AND brand IS NOT NULL AND brand <> ''
     GROUP BY brand
     ORDER BY n DESC
     LIMIT $2`,
    [category, limit]
  );
  return res.rows
    .map((r: any) => String(r.brand || "").trim())
    .filter((b) => b.length > 0);
});

// ============================================================
// Uncached reads — unique args per call, so caching wouldn't help.
// ============================================================

export async function searchProducts(query: string): Promise<Product[]> {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  // Multi-word AND match against name. GIN trigram index makes ILIKE fast.
  const words = q.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];

  const conditions = words.map((_, i) => `name ILIKE $${i + 1}`).join(" AND ");
  const args = words.map((w) => `%${w}%`);

  const res = await pool.query(
    `SELECT ${PRODUCT_COLUMNS} FROM products WHERE ${conditions} LIMIT 50`,
    args
  );
  return res.rows.map(rowToProduct);
}

export async function getDeals(): Promise<Product[]> {
  const res = await pool.query(
    `SELECT ${PRODUCT_COLUMNS}
     FROM products
     WHERE min_price < max_price
       AND max_price > 0
       AND current_price IS NOT NULL
     ORDER BY (max_price - current_price) / max_price DESC
     LIMIT 12`
  );
  return res.rows.map(rowToProduct);
}

// ============================================================
// Static JSON files — unchanged
// ============================================================

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

export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

export function getAmazonSearchUrl(productName: string): string {
  return `https://www.amazon.ca/s?k=${encodeURIComponent(productName)}&tag=trackaura00-20`;
}

// ============================================================
// Lineage — unchanged (reads static JSON + calls getProductsByCategory)
// ============================================================

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
// ============================================================

export interface ProductFilters {
  category?: string;
  retailer?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export interface FilteredProductsResult {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Quality filters — same semantics as the Turso version, Postgres syntax.
// Excludes: short names, template-placeholder rows ({ or }), sub-$5
// prices, and rows where max_price is more than 10x min_price (scrape glitches).
const QUALITY_CLAUSES: string[] = [
  "length(name) >= 15",
  "position('{' in name) = 0",
  "position('}' in name) = 0",
  "current_price >= 5",
  "NOT (max_price > min_price * 10 AND min_price > 0)",
];

const SORT_EXPRESSIONS: Record<string, string> = {
  "biggest-drop":
    "CASE WHEN max_price > 0 AND max_price > min_price " +
    "THEN (max_price - current_price) / max_price ELSE -1 END DESC",
  "at-lowest":
    "CASE WHEN current_price <= min_price AND price_count > 1 THEN 0 ELSE 1 END ASC, " +
    "price_count DESC",
  "price-asc":
    "CASE WHEN current_price < 1 THEN 2 ELSE 1 END ASC, current_price ASC",
  "price-desc": "current_price DESC",
  newest: "first_seen DESC",
  name: "name ASC",
};

export async function getFilteredProducts(
  filters: ProductFilters
): Promise<FilteredProductsResult> {
  const pageSize = filters.pageSize ?? 48;
  const page = Math.max(1, filters.page ?? 1);

  const whereClauses: string[] = [...QUALITY_CLAUSES];
  const whereArgs: unknown[] = [];

  const pushArg = (value: unknown) => {
    whereArgs.push(value);
    return `$${whereArgs.length}`;
  };

  if (filters.category && filters.category !== "all") {
    whereClauses.push(`category = ${pushArg(filters.category)}`);
  }
  if (filters.retailer && filters.retailer !== "all") {
    whereClauses.push(`retailer = ${pushArg(filters.retailer)}`);
  }
  if (typeof filters.minPrice === "number" && !isNaN(filters.minPrice)) {
    whereClauses.push(`current_price >= ${pushArg(filters.minPrice)}`);
  }
  if (typeof filters.maxPrice === "number" && !isNaN(filters.maxPrice)) {
    whereClauses.push(`current_price <= ${pushArg(filters.maxPrice)}`);
  }

  if (filters.search && filters.search.trim()) {
    const words = filters.search
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0);
    for (const w of words) {
      whereClauses.push(`name ILIKE ${pushArg(`%${w}%`)}`);
    }
  }

  const whereSQL = whereClauses.join(" AND ");
  const sortSQL =
    SORT_EXPRESSIONS[filters.sort || "biggest-drop"] ||
    SORT_EXPRESSIONS["biggest-drop"];

  // Count and page queries in parallel, each with its own args.
  const countQueryText = `SELECT COUNT(*)::int AS n FROM products WHERE ${whereSQL}`;
  const countArgs = [...whereArgs];

  const pageArgs = [...whereArgs, pageSize, (page - 1) * pageSize];
  const limitIdx = whereArgs.length + 1;
  const offsetIdx = whereArgs.length + 2;
  const pageQueryText =
    `SELECT ${PRODUCT_COLUMNS} FROM products WHERE ${whereSQL} ` +
    `ORDER BY ${sortSQL} LIMIT $${limitIdx} OFFSET $${offsetIdx}`;

  const [countRes, pageRes] = await Promise.all([
    pool.query(countQueryText, countArgs),
    pool.query(pageQueryText, pageArgs),
  ]);

  const total = Number(countRes.rows[0]?.n) || 0;
  const products = pageRes.rows.map(rowToProduct);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return { products, total, page, pageSize, totalPages };
}
