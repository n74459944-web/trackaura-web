import { Suspense } from "react";
import { Metadata } from "next";
import ProductsClient from "./ProductsClient";
import { Product } from "@/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "All Products",
  description:
    "Browse and filter all tracked Canadian electronics products. Compare prices across Canada Computers and Newegg Canada.",
};

async function getProducts(): Promise<Product[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
    const res = await fetch(`${baseUrl}/data/products.json`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <Suspense
      fallback={
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "4rem 1.5rem", textAlign: "center", color: "var(--text-secondary)" }}>
          Loading products...
        </div>
      }
    >
      <ProductsClient initialProducts={products} />
    </Suspense>
  );
}
