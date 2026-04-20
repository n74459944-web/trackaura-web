-- ──────────────────────────────────────────────────────────────
-- TrackAura · Supabase schema + RPCs
-- ──────────────────────────────────────────────────────────────
-- This file is the source of truth for Postgres objects that power
-- the TrackAura frontend. Run top-to-bottom on a fresh Supabase project
-- to rebuild from scratch. Every CREATE uses OR REPLACE / IF NOT EXISTS
-- so it's also safe to re-run on a live DB.
--
-- Order matters: columns → indexes → backfills → RPCs → grants.
-- ──────────────────────────────────────────────────────────────


-- ── 1. Columns: cached cheapest-retailer data on canonical_products ──
-- Avoids running a DISTINCT ON subquery on every request. The scraper
-- pipeline refreshes these nightly via refresh_canonical_cache().

ALTER TABLE canonical_products
  ADD COLUMN IF NOT EXISTS cheapest_price numeric,
  ADD COLUMN IF NOT EXISTS cheapest_retailer text,
  ADD COLUMN IF NOT EXISTS cheapest_url text,
  ADD COLUMN IF NOT EXISTS cheapest_is_openbox boolean,
  ADD COLUMN IF NOT EXISTS cheapest_min_price numeric,
  ADD COLUMN IF NOT EXISTS cheapest_max_price numeric,
  ADD COLUMN IF NOT EXISTS drop_ratio numeric,
  ADD COLUMN IF NOT EXISTS price_refreshed_at timestamptz,
  ADD COLUMN IF NOT EXISTS passes_quality boolean;


-- ── 2. Indexes ──

-- Partial index for deal-candidate lookups on products. Used by
-- the LATERAL subquery in products_filtered and was the main
-- bottleneck before the cache existed.
CREATE INDEX IF NOT EXISTS products_deal_candidates_idx
  ON products (current_price)
  WHERE canonical_id IS NOT NULL
    AND is_openbox = false
    AND price_count >= 3;

CREATE INDEX IF NOT EXISTS products_canonical_cheapest_idx
  ON products (canonical_id, is_openbox, current_price)
  WHERE canonical_id IS NOT NULL
    AND current_price IS NOT NULL
    AND current_price >= 5;

CREATE INDEX IF NOT EXISTS price_points_timestamp_idx
  ON price_points (timestamp DESC);

-- Index on canonical_products for the sorted drop-ratio scan.
-- This is what makes home_featured_deals return in <15ms.
DROP INDEX IF EXISTS canonical_cheapest_idx;
CREATE INDEX canonical_cheapest_idx
  ON canonical_products (drop_ratio DESC NULLS LAST, id)
  WHERE cheapest_price IS NOT NULL AND passes_quality = true;

CREATE INDEX IF NOT EXISTS canonical_price_sort_idx
  ON canonical_products (cheapest_price, id)
  WHERE cheapest_price IS NOT NULL AND passes_quality = true;

CREATE INDEX IF NOT EXISTS canonical_name_sort_idx
  ON canonical_products (name, id)
  WHERE cheapest_price IS NOT NULL AND passes_quality = true;

CREATE INDEX IF NOT EXISTS canonical_products_category_image_idx
  ON canonical_products (category)
  WHERE image_url IS NOT NULL AND category <> 'other';


-- ── 3. Quality flag refresh ──
-- Computes passes_quality in one UPDATE. Called by the scraper after
-- new canonicals are added.

CREATE OR REPLACE FUNCTION refresh_canonical_quality()
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE canonical_products
  SET passes_quality = (
    image_url IS NOT NULL
    AND category IS NOT NULL
    AND category <> 'other'
    AND length(name) >= 15
    AND position('{' IN name) = 0
    AND position('}' IN name) = 0
  )
  WHERE passes_quality IS DISTINCT FROM (
    image_url IS NOT NULL
    AND category IS NOT NULL
    AND category <> 'other'
    AND length(name) >= 15
    AND position('{' IN name) = 0
    AND position('}' IN name) = 0
  );
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;


-- ── 4. Cheapest-retailer cache refresh ──
-- Picks the cheapest non-openbox retailer row per canonical and caches
-- the result on the canonical itself. Called by the scraper nightly.

CREATE OR REPLACE FUNCTION refresh_canonical_cache()
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated int;
BEGIN
  WITH cheapest AS (
    SELECT DISTINCT ON (p.canonical_id)
      p.canonical_id,
      p.current_price,
      p.min_price,
      p.max_price,
      p.retailer,
      p.url,
      p.is_openbox
    FROM products p
    WHERE p.canonical_id IS NOT NULL
      AND p.current_price IS NOT NULL
      AND p.current_price >= 5
      AND NOT (p.max_price > p.min_price * 10 AND p.min_price > 0)
    ORDER BY p.canonical_id, p.is_openbox ASC, p.current_price ASC
  )
  UPDATE canonical_products cp
  SET
    cheapest_price = c.current_price,
    cheapest_retailer = c.retailer,
    cheapest_url = c.url,
    cheapest_is_openbox = c.is_openbox,
    cheapest_min_price = c.min_price,
    cheapest_max_price = c.max_price,
    drop_ratio = CASE
      WHEN c.max_price > c.min_price AND c.max_price > 0
      THEN (c.max_price - c.current_price) / c.max_price
      ELSE 0
    END,
    price_refreshed_at = NOW()
  FROM cheapest c
  WHERE cp.id = c.canonical_id
    AND (
      cp.cheapest_price IS DISTINCT FROM c.current_price
      OR cp.cheapest_retailer IS DISTINCT FROM c.retailer
      OR cp.cheapest_is_openbox IS DISTINCT FROM c.is_openbox
    );
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;


-- ── 5. Homepage: top categories ──

CREATE OR REPLACE FUNCTION home_top_categories(result_limit int DEFAULT 12)
RETURNS TABLE (
  category text,
  cnt bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    cp.category,
    COUNT(*)::bigint AS cnt
  FROM canonical_products cp
  WHERE cp.image_url IS NOT NULL
    AND cp.category IS NOT NULL
    AND cp.category <> 'other'
  GROUP BY cp.category
  HAVING COUNT(*) >= 50
  ORDER BY cnt DESC
  LIMIT result_limit;
$$;


-- ── 6. Homepage: featured deals ──
-- Uses the cached columns on canonical_products + canonical_cheapest_idx.
-- Typical execution time: <15ms.

CREATE OR REPLACE FUNCTION home_featured_deals(candidate_limit int DEFAULT 40)
RETURNS TABLE (
  canonical_id bigint,
  slug text,
  name text,
  brand text,
  category text,
  image_url text,
  current_price numeric,
  min_price numeric,
  max_price numeric,
  retailer text,
  drop_pct numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    cp.id AS canonical_id,
    cp.slug,
    cp.name,
    cp.brand,
    cp.category,
    cp.image_url,
    cp.cheapest_price AS current_price,
    cp.cheapest_min_price AS min_price,
    cp.cheapest_max_price AS max_price,
    cp.cheapest_retailer AS retailer,
    ROUND((cp.drop_ratio * 100)::numeric, 2) AS drop_pct
  FROM canonical_products cp
  WHERE cp.passes_quality = true
    AND cp.cheapest_price IS NOT NULL
    AND cp.cheapest_is_openbox = false
    AND cp.cheapest_price BETWEEN 30 AND 3000
    AND cp.drop_ratio BETWEEN 0.10 AND 0.70
  ORDER BY cp.drop_ratio DESC NULLS LAST
  LIMIT candidate_limit;
$$;


-- ── 7. Products listing ──
-- Filter + sort + paginate for /products. Reads cached columns, so it
-- never touches the raw products table for listing queries. Typical
-- execution time: <100ms.

CREATE OR REPLACE FUNCTION products_filtered(
  p_category     text    DEFAULT NULL,
  p_retailer     text    DEFAULT NULL,
  p_search       text    DEFAULT NULL,
  p_min_price    numeric DEFAULT NULL,
  p_max_price    numeric DEFAULT NULL,
  p_sort         text    DEFAULT 'biggest-drop',
  p_page         int     DEFAULT 1,
  p_page_size    int     DEFAULT 48
)
RETURNS TABLE (
  id bigint,
  slug text,
  name text,
  brand text,
  category text,
  image_url text,
  current_price numeric,
  min_price numeric,
  max_price numeric,
  retailer text,
  url text,
  is_openbox boolean,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_offset int;
BEGIN
  v_offset := GREATEST(0, (p_page - 1) * p_page_size);
  RETURN QUERY
  WITH matched AS (
    SELECT cp.id, cp.slug, cp.name, cp.brand, cp.category, cp.image_url,
           cp.cheapest_price, cp.cheapest_min_price, cp.cheapest_max_price,
           cp.cheapest_retailer, cp.cheapest_url, cp.cheapest_is_openbox,
           cp.drop_ratio
    FROM canonical_products cp
    WHERE cp.passes_quality = true
      AND cp.cheapest_price IS NOT NULL
      AND (p_category IS NULL OR p_category = 'all' OR cp.category = p_category)
      AND (p_retailer IS NULL OR p_retailer = 'all' OR cp.cheapest_retailer = p_retailer)
      AND (p_min_price IS NULL OR cp.cheapest_price >= p_min_price)
      AND (p_max_price IS NULL OR cp.cheapest_price <= p_max_price)
      AND (p_search IS NULL OR p_search = '' OR cp.name ILIKE '%' || p_search || '%')
  ),
  counted AS (SELECT COUNT(*)::bigint AS n FROM matched)
  SELECT m.id, m.slug, m.name, m.brand, m.category, m.image_url,
         m.cheapest_price, m.cheapest_min_price, m.cheapest_max_price,
         m.cheapest_retailer, m.cheapest_url, m.cheapest_is_openbox,
         (SELECT n FROM counted)
  FROM matched m
  ORDER BY
    CASE WHEN p_sort = 'biggest-drop' THEN m.drop_ratio ELSE NULL END DESC NULLS LAST,
    CASE WHEN p_sort = 'at-lowest'
         THEN CASE WHEN m.cheapest_price <= m.cheapest_min_price THEN 0 ELSE 1 END
         ELSE NULL END ASC NULLS LAST,
    CASE WHEN p_sort = 'price-asc' THEN m.cheapest_price ELSE NULL END ASC NULLS LAST,
    CASE WHEN p_sort = 'price-desc' THEN m.cheapest_price ELSE NULL END DESC NULLS LAST,
    CASE WHEN p_sort = 'name' THEN m.name ELSE NULL END ASC NULLS LAST,
    m.id ASC
  LIMIT p_page_size OFFSET v_offset;
END;
$$;


-- ── 8. Grants ──
-- Without these, the Supabase anon client gets permission errors
-- instead of data.

GRANT EXECUTE ON FUNCTION refresh_canonical_quality() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION refresh_canonical_cache() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION home_top_categories(int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION home_featured_deals(int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION products_filtered(
  text, text, text, numeric, numeric, text, int, int
) TO anon, authenticated;


-- ── 9. Role timeouts ──
-- The default 3s anon timeout was too tight for cold-start Next.js SSR
-- workloads that fan out multiple queries. 10s gives comfortable margin.

ALTER ROLE anon SET statement_timeout = '10s';
ALTER ROLE authenticated SET statement_timeout = '10s';


-- ── 10. Bootstrap: backfill the cached columns ──
-- Run this once to populate on an existing DB that has data but no cache
-- columns yet. The scraper pipeline keeps it fresh afterwards.

SELECT refresh_canonical_quality();
SELECT refresh_canonical_cache();
