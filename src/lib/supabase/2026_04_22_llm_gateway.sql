-- =====================================================================
-- TrackAura — LLM Gateway v1
-- Migration: 2026_04_22_llm_gateway
-- Target: Supabase Postgres
-- Apply via: `supabase db push` OR paste into the Supabase SQL Editor.
--
-- Adds:
--   1. llm_calls           — audit log of every LLM call (cost, tokens)
--   2. llm_budget_status() — rollup: current-month spend vs $100 cap
--   3. search_gpu_chip_candidates() — pg_trgm-ranked candidates for
--      candidate-aware tier-3 resolution (see ARCHITECTURE.md §4 Tier 3)
-- =====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------
-- 1. llm_calls
-- Every LLM call writes one row here. Purpose is audit + cost rollup.
-- Not on the hot path — fire-and-forget inserts are fine.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS llm_calls (
  id              BIGSERIAL PRIMARY KEY,
  provider        TEXT NOT NULL,                 -- 'anthropic', 'openai', 'google'
  model           TEXT NOT NULL,                 -- e.g. 'claude-haiku-4-5-20251001'
  purpose         TEXT NOT NULL,                 -- 'chip_suggest', 'resolve_listing', ...
  input_tokens    INTEGER NOT NULL,
  output_tokens   INTEGER NOT NULL,
  cost_usd        NUMERIC(12, 8) NOT NULL,
  called_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_llm_calls_called_at
  ON llm_calls(called_at DESC);

CREATE INDEX IF NOT EXISTS idx_llm_calls_purpose
  ON llm_calls(purpose, called_at DESC);

-- ---------------------------------------------------------------------
-- 2. llm_budget_status(monthly_cap_usd, breaker_threshold)
-- Returns current month spend, utilization %, and breaker state.
-- Called by the TS budget helper on every LLM call.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION llm_budget_status(
  monthly_cap_usd NUMERIC DEFAULT 100,
  breaker_threshold NUMERIC DEFAULT 0.80
)
RETURNS TABLE (
  month_cost_usd   NUMERIC,
  monthly_cap_usd  NUMERIC,
  utilization_pct  NUMERIC,
  breaker_open     BOOLEAN,
  call_count       INTEGER
)
LANGUAGE SQL
STABLE
AS $$
  WITH month_calls AS (
    SELECT cost_usd
    FROM llm_calls
    WHERE called_at >= DATE_TRUNC('month', NOW())
      AND called_at <  DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
  )
  SELECT
    COALESCE(SUM(cost_usd), 0)::NUMERIC AS month_cost_usd,
    llm_budget_status.monthly_cap_usd   AS monthly_cap_usd,
    CASE
      WHEN llm_budget_status.monthly_cap_usd <= 0 THEN 0
      ELSE ROUND((COALESCE(SUM(cost_usd), 0) / llm_budget_status.monthly_cap_usd) * 100, 2)
    END AS utilization_pct,
    (COALESCE(SUM(cost_usd), 0) / NULLIF(llm_budget_status.monthly_cap_usd, 0))
      >= llm_budget_status.breaker_threshold AS breaker_open,
    COUNT(*)::INTEGER AS call_count
  FROM month_calls;
$$;

-- ---------------------------------------------------------------------
-- 3. search_gpu_chip_candidates(query_text, max_results)
-- Returns top-N gpu_chip entities ranked by pg_trgm similarity against
-- a board listing name. Used by the admin review UI and (later) the
-- resolution engine's tier 3 to supply candidates to the LLM.
--
-- Does NOT filter by the % threshold operator: we want a non-empty
-- candidate list whenever possible, since an empty list defeats the
-- purpose of candidate-aware LLM calls. If rankings are noisy at the
-- tail, the LLM can still pick 'no match' and propose a new chip.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION search_gpu_chip_candidates(
  query_text TEXT,
  max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
  id              BIGINT,
  canonical_name  TEXT,
  brand           TEXT,
  similarity      REAL
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    ce.id,
    ce.canonical_name,
    ce.brand,
    similarity(ce.canonical_name, query_text) AS similarity
  FROM canonical_entities ce
  WHERE ce.entity_type = 'gpu_chip'
  ORDER BY similarity(ce.canonical_name, query_text) DESC
  LIMIT max_results;
$$;

COMMIT;
