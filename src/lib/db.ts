/**
 * Postgres connection pool for Supabase.
 *
 * Uses `pg` (node-postgres) connected via Supabase's Session Pooler.
 *
 * We parse SUPABASE_DB_URL with Node's URL class and pass explicit
 * parameters to Pool() instead of handing it the raw connection string.
 * Reason: libpq's URL parser (used internally by some pg builds) can
 * mishandle the dot in usernames like `postgres.PROJECT_REF`, silently
 * stripping the project ref and causing auth failures. Parsing at the
 * app layer avoids that entirely.
 *
 * Pool is cached on globalThis in development so Next.js hot reloads
 * don't create a new pool on every file change.
 */
import { Pool, PoolConfig } from "pg";

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
        "Use the Session Pooler connection string (username format: 'postgres.PROJECT_REF')."
    );
  }

  return {
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    database: url.pathname.replace(/^\//, "") || "postgres",
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30_000,
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
