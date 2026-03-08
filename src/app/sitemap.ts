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

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.trackaura.com";
  const products = getAllProducts();
  const today = new Date().toISOString().split("T")[0];

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: today, changeFrequency: "daily", priority: 1.0 },
    { url: baseUrl + "/products", lastModified: today, changeFrequency: "daily", priority: 0.9 },
    { url: baseUrl + "/deals", lastModified: today, changeFrequency: "daily", priority: 0.9 },
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

  const productPages: MetadataRoute.Sitemap = products.map((product) => ({
    url: baseUrl + "/product/" + product.slug,
    lastModified: formatDate(product.lastUpdated),
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...categoryPages, ...bestPages, ...productPages];
}
