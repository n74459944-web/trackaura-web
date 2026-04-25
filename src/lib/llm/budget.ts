/**
 * LLM budget helper.
 *
 * Target path: C:\dev\trackaura-web\lib\llm\budget.ts
 *
 * Responsibilities:
 *   - Check current-month spend against the $100 cap before every call
 *   - Throw BudgetExceededError when the circuit breaker (80%) trips
 *   - Record cost + token usage after every successful call
 *
 * See ARCHITECTURE.md §7 and §11 risk 2.
 */

import { createAdminClient } from '@/lib/supabase/admin';

// Pricing per 1M tokens. USD.
// TODO: verify current Anthropic pricing before high-volume run.
const MODEL_PRICING: Record<
  string,
  { input_per_mtok: number; output_per_mtok: number }
> = {
  'claude-haiku-4-5-20251001': { input_per_mtok: 1.0, output_per_mtok: 5.0 },
};

export const MONTHLY_CAP_USD = 100;
export const BREAKER_THRESHOLD = 0.8;

export type BudgetStatus = {
  month_cost_usd: number;
  monthly_cap_usd: number;
  utilization_pct: number;
  breaker_open: boolean;
  call_count: number;
};

export class BudgetExceededError extends Error {
  public readonly status: BudgetStatus;
  constructor(status: BudgetStatus) {
    super(
      `LLM budget circuit breaker open: ${status.utilization_pct}% of $${status.monthly_cap_usd} cap ` +
        `($${status.month_cost_usd.toFixed(4)} spent across ${status.call_count} calls this month). ` +
        `Raise MONTHLY_CAP_USD or wait for next month.`,
    );
    this.name = 'BudgetExceededError';
    this.status = status;
  }
}

/**
 * Read the current-month rollup. Does not block; always returns a status.
 */
export async function getBudgetStatus(): Promise<BudgetStatus> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .rpc('llm_budget_status', {
      monthly_cap_usd: MONTHLY_CAP_USD,
      breaker_threshold: BREAKER_THRESHOLD,
    })
    .single();

  if (error) {
    throw new Error(`llm_budget_status RPC: ${error.message}`);
  }
  if (!data) {
    throw new Error('llm_budget_status returned no data');
  }

  const row = data as {
    month_cost_usd: number | string;
    monthly_cap_usd: number | string;
    utilization_pct: number | string;
    breaker_open: boolean;
    call_count: number | string;
  };

  return {
    month_cost_usd: Number(row.month_cost_usd),
    monthly_cap_usd: Number(row.monthly_cap_usd),
    utilization_pct: Number(row.utilization_pct),
    breaker_open: Boolean(row.breaker_open),
    call_count: Number(row.call_count),
  };
}

/**
 * Throw if the circuit breaker is open. Call before every LLM request.
 */
export async function checkBudget(): Promise<BudgetStatus> {
  const status = await getBudgetStatus();
  if (status.breaker_open) {
    throw new BudgetExceededError(status);
  }
  return status;
}

/**
 * Compute the USD cost of a call based on model + token counts.
 * Unknown models return 0 with a console warning — we still log the row
 * so we can audit later, we just don't count it against the budget.
 */
export function calculateCost(
  model: string,
  input_tokens: number,
  output_tokens: number,
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    console.warn(`[llm-budget] unknown model pricing: ${model}`);
    return 0;
  }
  return (
    (input_tokens / 1_000_000) * pricing.input_per_mtok +
    (output_tokens / 1_000_000) * pricing.output_per_mtok
  );
}

/**
 * Log a completed LLM call to llm_calls. Failures are logged but
 * swallowed so they never break the user-facing call path.
 */
export async function recordCall(params: {
  provider: string;
  model: string;
  purpose: string;
  input_tokens: number;
  output_tokens: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const cost_usd = calculateCost(
    params.model,
    params.input_tokens,
    params.output_tokens,
  );

  const supabase = createAdminClient();
  const { error } = await supabase.from('llm_calls').insert({
    provider: params.provider,
    model: params.model,
    purpose: params.purpose,
    input_tokens: params.input_tokens,
    output_tokens: params.output_tokens,
    cost_usd,
    metadata: params.metadata ?? {},
  });

  if (error) {
    console.error(`[llm-budget] failed to log call: ${error.message}`);
  }
}
