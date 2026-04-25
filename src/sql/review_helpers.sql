-- TrackAura · review queue helpers
-- Run in Supabase SQL editor. Safe to re-run.
--
-- Explicitly drops both possible prior signatures before creating the current
-- one so we don't end up with two overloaded versions that confuse PostgREST.
-- Ends with NOTIFY to force PostgREST to refresh its schema cache immediately
-- instead of waiting for its polling interval.

DROP FUNCTION IF EXISTS find_chip_candidates(text, integer);
DROP FUNCTION IF EXISTS find_chip_candidates(text, integer, text);

CREATE FUNCTION find_chip_candidates(
  board_name text,
  limit_n integer DEFAULT 10,
  search_query text DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  canonical_name text,
  brand text,
  similarity real
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    c.id,
    c.canonical_name,
    c.brand,
    similarity(
      c.canonical_name,
      COALESCE(search_query, board_name)
    ) AS similarity
  FROM canonical_entities c
  WHERE c.entity_type = 'gpu_chip'
    AND (
      search_query IS NULL
      OR c.canonical_name ILIKE '%' || search_query || '%'
    )
  ORDER BY similarity(
    c.canonical_name,
    COALESCE(search_query, board_name)
  ) DESC
  LIMIT limit_n;
$$;

GRANT EXECUTE ON FUNCTION find_chip_candidates(text, integer, text)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
