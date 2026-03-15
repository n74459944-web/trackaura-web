export interface Product {
  id: number;
  name: string;
  shortName?: string;
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
  imageUrl?: string;
  brand?: string;
  description?: string;
  specs?: Record<string, string>;
  matchGroup?: number | null;
  priceComparison?: {
    id: number;
    retailer: string;
    price: number;
    url: string;
    slug: string;
  }[];
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

export type Category = "headphones" | "gpus" | "ssds" | "monitors" | "keyboards" | "mice" | "laptops" | "ram" | "cpus" | "power-supplies" | "cases" | "motherboards" | "coolers" | "routers" | "webcams" | "speakers" | "external-storage" | "hard-drives" | "tvs" | "tablets" | "printers" | "gaming-consoles" | "smart-home" | "ups-power" | "network-switches" | "other";
export type Retailer = "Canada Computers" | "Newegg Canada";

export const CATEGORY_LABELS: Record<string, string> = {
  headphones: "Headphones",
  gpus: "Graphics Cards",
  ssds: "SSDs",
  "hard-drives": "Hard Drives",
  monitors: "Monitors",
  keyboards: "Keyboards",
  mice: "Mice",
  laptops: "Laptops",
  ram: "RAM",
  cpus: "CPUs",
  "power-supplies": "Power Supplies",
  cases: "PC Cases",
  motherboards: "Motherboards",
  other: "Other",
  coolers: "CPU Coolers",
  routers: "Routers",
  webcams: "Webcams",
  speakers: "Speakers",
  "external-storage": "External Storage",
  tvs: "TVs",
  tablets: "Tablets",
  printers: "Printers",
  "gaming-consoles": "Gaming Consoles",
  "smart-home": "Smart Home",
  "ups-power": "UPS & Surge Protection",
  "network-switches": "Network Switches",
};

export const CATEGORY_ICONS: Record<string, string> = {
  headphones: "🎧",
  gpus: "🖥️",
  ssds: "💾",
  "hard-drives": "💽",
  monitors: "🖥️",
  keyboards: "⌨️",
  mice: "🖱️",
  laptops: "💻",
  ram: "🧠",
  cpus: "⚡",
  "power-supplies": "🔌",
  cases: "🗄️",
  motherboards: "🔧",
  other: "📦",
  coolers: "❄️",
  routers: "📡",
  webcams: "📷",
  speakers: "🔊",
  "external-storage": "💿",
  tvs: "📺",
  tablets: "📱",
  printers: "🖨️",
  "gaming-consoles": "🎮",
  "smart-home": "🏠",
  "ups-power": "🔋",
  "network-switches": "🔀",
};

export const RETAILER_COLORS: Record<string, string> = {
  "Canada Computers": "#e63946",
  "Newegg Canada": "#f77f00",
};

export const AMAZON_AFFILIATE_TAG = "trackaura00-20";
