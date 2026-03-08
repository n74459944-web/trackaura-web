import { Suspense } from "react";
import { Metadata } from "next";
import DealsClient from "./DealsClient";

export const metadata: Metadata = {
  title: "Best Electronics Deals in Canada",
  description:
    "Find the best electronics deals across Canadian retailers. Track price drops on GPUs, headphones, SSDs, monitors, keyboards, mice, and laptops at Canada Computers and Newegg Canada.",
  alternates: {
    canonical: "https://www.trackaura.com/deals",
  },
};

export default function DealsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "4rem 1.5rem", textAlign: "center", color: "var(--text-secondary)" }}>
          Loading deals...
        </div>
      }
    >
      <DealsClient />
    </Suspense>
  );
}
