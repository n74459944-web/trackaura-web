/**
 * Postgres connection pool for Supabase.
 *
 * Uses `pg` (node-postgres) connected via Supabase's TRANSACTION POOLER
 * (port 6543), NOT the Session Pooler (port 5432). Reason:
 *
 *   - Session Pooler has a 15-connection cap. Next.js static generation
 *     spawns ~29 parallel workers, each with its own Pool — guaranteed to
 *     blow past the cap and fail the build with EMAXCONNSESSION.
 *   - Transaction Pooler multiplexes hundreds of clients onto a small
 *     backend pool. Perfect for serverless Lambdas and static generation.
 *
 * The Transaction Pooler has tradeoffs:
 *   - No session-level state (SET LOCAL, advisory locks, LISTEN/NOTIFY).
 *   - No long-lived transactions.
 *   - Unnamed prepared statements are fine (pg's default for parameterized
 *     queries); named prepared statements are not.
 *
 * None of those restrictions matter for data.ts — all queries are simple
 * parameterized SELECTs. The backend sync script (sync_to_supabase.py)
 * keeps using the Session Pooler because it needs long transactions.
 *
 * We parse SUPABASE_DB_URL ourselves and pass explicit parameters to
 * Pool() to sidestep libpq's URL parser, which mishandles the dot in
 * usernames like `postgres.PROJECT_REF`.
 */
import { Pool, PoolConfig } from "pg";

const TRANSACTION_POOLER_PORT = 6543;

const globalForPool = globalThis as unknown as { _pgPool?: Pool };

function parseConnectionString(raw: string): PoolConfig {
  const cleaned = raw.trim().replace(/^['"]|['"]$/g, "");
  let url: URL;
  try {
    url = new URL(cleaned);
  } catch (err) {
    throw new Error(
      `SUPABASE_DB_URL is not a valid URL: ${(err as Error).message}`
    );
  }

  if (!url.username) {
    throw new Error("SUPABASE_DB_URL is missing a username.");
  }
  if (!url.username.includes(".")) {
    throw new Error(
      `SUPABASE_DB_URL username ${JSON.stringify(url.username)} has no dot. ` +
        "Use the pooler connection string (username format: 'postgres.PROJECT_REF')."
    );
  }

  return {
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    host: url.hostname,
    // Force Transaction Pooler port regardless of what the URL has.
    // Backend scripts keep their own port (5432) since they connect with
    // psycopg2 separately.
    port: TRANSACTION_POOLER_PORT,
    database: url.pathname.replace(/^\//, "") || "postgres",
    ssl: { rejectUnauthorized: false },
    // Small pool per instance. Build-time: ~29 workers × 3 = ~87 concurrent
    // connections — well under Transaction Pooler's ~200 cap. Runtime:
    // serverless instances scale horizontally; each uses 1-3 connections.
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  };
}

function createPool(): Pool {
  const raw = process.env.SUPABASE_DB_URL;
  if (!raw) {
    throw new Error(
      "SUPABASE_DB_URL is not set. Add it to .env.local for dev and to Vercel env vars for prod."
    );
  }
  return new Pool(parseConnectionString(raw));
}

export const pool: Pool = globalForPool._pgPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForPool._pgPool = pool;
}
