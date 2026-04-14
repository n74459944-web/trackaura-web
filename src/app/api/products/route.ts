import { createClient } from "@libsql/client/web";

// Edge runtime has no 4.5MB response body limit (serverless does).
// Required for 40K+ product catalogs where a full dump is ~15MB.
export const runtime = "edge";
export const revalidate = 14400;

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const PAGE_SIZE = 2000;

export async function GET() {
  try {
    const all: unknown[] = [];
    let offset = 0;

    // Chunk to stay under Turso's per-response size cap.
    while (true) {
      const res = await db.execute({
        sql: "SELECT data FROM products ORDER BY rowid LIMIT ? OFFSET ?",
        args: [PAGE_SIZE, offset],
      });
      for (const row of res.rows) {
        all.push(JSON.parse(row.data as string));
      }
      if (res.rows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    return new Response(JSON.stringify(all), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control":
          "public, s-maxage=14400, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("GET /api/products failed:", err);
    return new Response(
      JSON.stringify({ error: "Failed to load products" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
