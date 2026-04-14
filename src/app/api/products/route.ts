import { createClient } from "@libsql/client/web";

// Edge runtime: no 4.5MB body limit, 25s initial response window.
// Parallel page fetches to stay under the window — sequential chunks
// hit the 25s wall on ~40K products.
export const runtime = "edge";
export const revalidate = 14400;

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const PAGE_SIZE = 5000;

export async function GET() {
  try {
    // Count first so we know how many pages to fire in parallel.
    const countRes = await db.execute("SELECT COUNT(*) AS n FROM products");
    const total = Number(countRes.rows[0].n) || 0;
    if (total === 0) {
      return new Response("[]", {
        headers: { "Content-Type": "application/json" },
      });
    }

    const pageCount = Math.ceil(total / PAGE_SIZE);

    // Fire ALL page queries in parallel. With ~8 pages at 5000 each,
    // total wall-clock is roughly max(per-page latency) ~= 600ms,
    // not sum of them ~24s.
    const pageQueries = Array.from({ length: pageCount }, (_, i) =>
      db.execute({
        sql: "SELECT data FROM products ORDER BY rowid LIMIT ? OFFSET ?",
        args: [PAGE_SIZE, i * PAGE_SIZE],
      }),
    );
    const results = await Promise.all(pageQueries);

    const all: unknown[] = [];
    for (const res of results) {
      for (const row of res.rows) {
        all.push(JSON.parse(row.data as string));
      }
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
