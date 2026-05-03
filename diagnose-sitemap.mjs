// Diagnose why the products sitemap returns empty in production.
// Runs the EXACT same query as src/app/products-sitemap/sitemap.ts
// against Supabase from local Node, using the anon key from .env.local.
//
// Usage (from C:\dev\trackaura-web):
//   node diagnose-sitemap.mjs
//
// Reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from
// .env.local. No other dependencies required beyond what trackaura-web
// already has installed (@supabase/supabase-js).

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal() {
  let text;
  try {
    text = readFileSync('.env.local', 'utf8');
  } catch {
    console.error('No .env.local found in current directory.');
    console.error('Run this from C:\\dev\\trackaura-web');
    process.exit(1);
  }
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnvLocal();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

console.log('URL:', url);
console.log('Anon key (first 20 chars):', key.slice(0, 20) + '...');
console.log('');

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log('=== Test 1: count query (same as generateSitemaps) ===');
const t1 = Date.now();
const { count, error: countError, status: countStatus } = await supabase
  .from('canonical_products')
  .select('id', { count: 'exact', head: true })
  .not('image_url', 'is', null);
console.log('  Elapsed:', Date.now() - t1, 'ms');
console.log('  HTTP status:', countStatus);
console.log('  Count:', count);
console.log('  Error:', countError);
console.log('');

console.log('=== Test 2: data query (same as sitemap chunk 0) ===');
const t2 = Date.now();
const { data: rows, error: dataError, status: dataStatus } = await supabase
  .from('canonical_products')
  .select('slug, updated_at')
  .not('image_url', 'is', null)
  .order('id', { ascending: true })
  .range(0, 39999);
console.log('  Elapsed:', Date.now() - t2, 'ms');
console.log('  HTTP status:', dataStatus);
console.log('  Rows:', rows?.length ?? 'null');
console.log('  Error:', dataError);
if (rows?.length) {
  console.log('  First row:', rows[0]);
  console.log('  Last row:', rows[rows.length - 1]);
}
console.log('');

console.log('=== Test 3: simpler probe (no filters) ===');
const t3 = Date.now();
const { count: totalCount, error: totalError } = await supabase
  .from('canonical_products')
  .select('id', { count: 'exact', head: true });
console.log('  Elapsed:', Date.now() - t3, 'ms');
console.log('  Total count (no filter):', totalCount);
console.log('  Error:', totalError);
console.log('');

console.log('=== Diagnosis ===');
if (count === 18494 && rows?.length > 0) {
  console.log('  Query works locally. Bug is Vercel-build-specific.');
  console.log('  Next step: add error logging to sitemap.ts + redeploy.');
} else if (count === null || count === 0) {
  console.log('  Query fails locally too. Bug is in the query/auth path itself.');
  console.log('  Compare HTTP status above — 401/403 = auth, 5xx = server, 200+empty = RLS-shaped.');
} else {
  console.log('  Partial result. Investigate the count vs rows discrepancy.');
}
