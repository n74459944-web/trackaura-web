import { Suspense } from "react";
import { Metadata } from "next";
import { getAllProducts } from "@/lib/data";
import ProductsClient from "./ProductsClient";

export const metadata: Metadata = {
  title: "All Products",
  description:
    "Browse and filter all tracked Canadian electronics products. Compare prices across Canada Computers and Newegg Canada.",
};

export default function ProductsPage() {
  const products = getAllProducts();

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
