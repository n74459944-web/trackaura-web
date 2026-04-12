import { Suspense } from "react";
import { Metadata } from "next";
import fs from "fs";
import path from "path";
import ChangesClient from "./ChangesClient";

export const revalidate = 14400; // 4 hours, matches scrape cycle

export const metadata: Metadata = {
  title: "Recent Price Changes - Canadian Electronics",
  description: "Track real-time price drops and increases on electronics across Canadian retailers. See which GPUs, headphones, SSDs, and more just changed price.",
  alternates: { canonical: "https://www.trackaura.com/changes" },
};

function getChanges() {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "changes.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export default function ChangesPage() {
  const changes = getChanges();

  return (
    <Suspense fallback={<div style={{ maxWidth: 900, margin: "0 auto", padding: "4rem 1.5rem", textAlign: "center", color: "var(--text-secondary)" }}>Loading...</div>}>
      <ChangesClient initialChanges={changes} />
    </Suspense>
  );
}
