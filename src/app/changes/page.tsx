import { Suspense } from "react";
import { Metadata } from "next";
import ChangesClient from "./ChangesClient";

export const metadata: Metadata = {
  title: "Recent Price Changes - Canadian Electronics",
  description: "Track real-time price drops and increases on electronics across Canadian retailers. See which GPUs, headphones, SSDs, and more just changed price.",
  alternates: { canonical: "https://www.trackaura.com/changes" },
};

export default function ChangesPage() {
  return (
    <Suspense fallback={<div style={{ maxWidth: 900, margin: "0 auto", padding: "4rem 1.5rem", textAlign: "center", color: "var(--text-secondary)" }}>Loading...</div>}>
      <ChangesClient />
    </Suspense>
  );
}
