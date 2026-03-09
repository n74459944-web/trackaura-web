import { getAllProducts } from "@/lib/data";
import { CATEGORY_LABELS } from "@/types";
import { MetadataRoute } from "next";

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return new Date().toISOString().split("T")[0];
    return d.toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

function extractBrand(name: string): string {
  return name.split(/\s+/)[0]?.toUpperCase() || "";
}

function brandSlug(brand: string): string {
  return brand.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.trackaura.com";
  const products = getAllProducts();
  const today = new Date().toISOString().split("T")[0];

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: today, changeFrequency: "daily", priority: 1.0 },
    { url: baseUrl + "/products", lastModified: today, changeFrequency: "daily", priority: 0.9 },
    { url: baseUrl + "/deals", lastModified: today, changeFrequency: "daily", priority: 0.9 },
    { url: baseUrl + "/changes", lastModified: today, changeFrequency: "daily", priority: 0.85 },
    { url: baseUrl + "/about", lastModified: today, changeFrequency: "monthly", priority: 0.6 },
    { url: baseUrl + "/how-it-works", lastModified: today, changeFrequency: "monthly", priority: 0.6 },
    { url: baseUrl + "/privacy", lastModified: today, changeFrequency: "monthly", priority: 0.3 },
    { url: baseUrl + "/terms", lastModified: today, changeFrequency: "monthly", priority: 0.3 },
    { url: baseUrl + "/trends", lastModified: today, changeFrequency: "daily", priority: 0.9 },
  ];

  const categoryPages: MetadataRoute.Sitemap = Object.keys(CATEGORY_LABELS)
    .filter((k) => k !== "other")
    .map((cat) => ({
      url: baseUrl + "/products?category=" + cat,
      lastModified: today,
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));

  const bestPages: MetadataRoute.Sitemap = Object.keys(CATEGORY_LABELS)
    .filter((k) => k !== "other")
    .map((cat) => ({
      url: baseUrl + "/best/" + cat,
      lastModified: today,
      changeFrequency: "daily" as const,
      priority: 0.85,
    }));

  // Brand pages
  const brandCounts: Record<string, number> = {};
  for (const p of products) {
    const brand = extractBrand(p.name);
    if (brand.length >= 2) brandCounts[brand] = (brandCounts[brand] || 0) + 1;
  }
  const brandPages: MetadataRoute.Sitemap = Object.entries(brandCounts)
    .filter(([_, count]) => count >= 3)
    .map(([brand]) => ({
      url: baseUrl + "/brand/" + brandSlug(brand),
      lastModified: today,
      changeFrequency: "weekly" as const,
      priority: 0.75,
    }));

  const productPages: MetadataRoute.Sitemap = products.map((product) => ({
    url: baseUrl + "/product/" + product.slug,
    lastModified: formatDate(product.lastUpdated),
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...categoryPages, ...bestPages, ...brandPages, ...productPages];
}
