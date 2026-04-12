import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";
import { config } from "dotenv"; config({ path: ".env.local" });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const DATA_DIR = path.join(process.cwd(), "public", "data");

async function main() {
  console.log("Importing products...");
  const products = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "products.json"), "utf-8")
  );
  for (let i = 0; i < products.length; i += 500) {
    const batch = products.slice(i, i + 500);
    await db.batch(
      batch.map((p: any) => ({
        sql: `INSERT OR REPLACE INTO products (id, slug, name, category, retailer, currentPrice, minPrice, maxPrice, priceCount, data)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          p.id, p.slug, p.name, p.category ?? null, p.retailer ?? null,
          p.currentPrice ?? 0, p.minPrice ?? 0, p.maxPrice ?? 0, p.priceCount ?? 0,
          JSON.stringify(p),
        ],
      })),
      "write"
    );
    console.log(`  products ${i + batch.length}/${products.length}`);
  }

  console.log("Importing price history...");
  const historyDir = path.join(DATA_DIR, "history");
  const files = fs.readdirSync(historyDir).filter((f) => f.endsWith(".json"));
  for (let i = 0; i < files.length; i++) {
    const productId = parseInt(files[i].replace(".json", ""), 10);
    const points = JSON.parse(
      fs.readFileSync(path.join(historyDir, files[i]), "utf-8")
    );
    if (!points.length) continue;
    for (let j = 0; j < points.length; j += 500) {
      const chunk = points.slice(j, j + 500);
      await db.batch(
        chunk.map((pt: any) => ({
          sql: `INSERT OR REPLACE INTO price_history (product_id, ts, price) VALUES (?, ?, ?)`,
          args: [productId, pt.date ?? pt.ts, pt.price],
        })),
        "write"
      );
    }
    if (i % 500 === 0) console.log(`  history ${i}/${files.length}`);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
