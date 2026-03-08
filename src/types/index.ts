export interface Product {
  id: number;
  name: string;
  slug: string;
  url: string;
  retailer: string;
  category: string;
  currentPrice: number;
  minPrice: number;
  maxPrice: number;
  priceCount: number;
  firstSeen: string;
  lastUpdated: string;
}

export interface PricePoint {
  price: number;
  date: string;
}

export interface SiteStats {
  totalProducts: number;
  totalPricePoints: number;
  retailers: string[];
  categories: string[];
  lastUpdated: string;
  productsByRetailer: Record<string, number>;
  productsByCategory: Record<string, number>;
}

export type Category = "headphones" | "gpus" | "ssds" | "other";
export type Retailer = "Canada Computers" | "Newegg Canada";

export const CATEGORY_LABELS: Record<string, string> = {
  headphones: "Headphones",
  gpus: "Graphics Cards",
  ssds: "SSDs",
  other: "Other",
};

export const RETAILER_COLORS: Record<string, string> = {
  "Canada Computers": "#e63946",
  "Newegg Canada": "#f77f00",
};

export const AMAZON_AFFILIATE_TAG = "trackaura00-20";
