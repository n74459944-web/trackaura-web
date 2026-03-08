import { getAllProducts } from "@/lib/data";
import { CATEGORY_LABELS } from "@/types";
import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.trackaura.com";
  const products = getAllProducts();
  const now = new Date().toISOString();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/products`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  // Category pages
  const categoryPages: MetadataRoute.Sitemap = Object.keys(CATEGORY_LABELS).map(
    (cat) => ({
      url: `${baseUrl}/products?category=${cat}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })
  );

  // Product pages
  const productPages: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${baseUrl}/product/${product.slug}`,
    lastModified: product.lastUpdated || now,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...categoryPages, ...productPages];
}
