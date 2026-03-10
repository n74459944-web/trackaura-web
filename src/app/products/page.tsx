import { Suspense } from "react";
import { Metadata } from "next";
import fs from "fs";
import path from "path";
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
    const filePath = path.join(process.cwd(), "public", "data", "products.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
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
