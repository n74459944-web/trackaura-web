'use server';

import { createClient } from '@/lib/supabase/server';

export type CreatePriceAlertInput = {
  email: string;
  productSlug: string;
  productName: string;
  targetPrice: number;
  currentPrice: number;
  retailer: string | null;
};

export type CreatePriceAlertResult =
  | { ok: true }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createPriceAlert(
  input: CreatePriceAlertInput,
): Promise<CreatePriceAlertResult> {
  // ── Validation ──────────────────────────────────────────────────
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, error: 'Enter a valid email address.' };
  }
  if (!Number.isFinite(input.targetPrice) || input.targetPrice <= 0) {
    return { ok: false, error: 'Target price must be greater than zero.' };
  }
  if (input.targetPrice > 100_000) {
    return { ok: false, error: 'Target price looks too high.' };
  }
  if (input.currentPrice > 0 && input.targetPrice >= input.currentPrice) {
    return {
      ok: false,
      error: 'Target must be below the current price to be useful.',
    };
  }
  if (!input.productSlug || !input.productName) {
    return { ok: false, error: 'Product information missing.' };
  }

  // ── Insert ──────────────────────────────────────────────────────
  const supabase = await createClient();
  const { error } = await supabase.from('price_alerts').insert({
    email,
    product_slug: input.productSlug,
    product_name: input.productName,
    target_price: input.targetPrice,
    current_price: input.currentPrice,
    retailer: input.retailer,
    triggered: false,
  });

  if (error) {
    console.error('[price-alert] insert failed:', error);
    // Friendly message — don't leak DB details to the client.
    return {
      ok: false,
      error: 'Could not save alert. Please try again in a moment.',
    };
  }

  return { ok: true };
}
