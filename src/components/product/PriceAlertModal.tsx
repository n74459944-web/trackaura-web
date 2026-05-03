'use client';

import { useState, useEffect } from 'react';
import { X, Bell, Check, Loader2 } from 'lucide-react';
import { createPriceAlert } from '@/app/actions/price-alerts';

export type PriceAlertModalProps = {
  open: boolean;
  onClose: () => void;
  productSlug: string;
  productName: string;
  currentPrice: number;
  retailer: string | null;
};

const fmtPrice = (n: number) =>
  `$${Math.round(n).toLocaleString('en-CA', { maximumFractionDigits: 0 })}`;

function defaultTarget(currentPrice: number): number {
  if (currentPrice <= 0) return 100;
  return Math.max(1, Math.round(currentPrice * 0.9));
}

export default function PriceAlertModal({
  open,
  onClose,
  productSlug,
  productName,
  currentPrice,
  retailer,
}: PriceAlertModalProps) {
  const [email, setEmail] = useState('');
  const [targetPrice, setTargetPrice] = useState(() =>
    defaultTarget(currentPrice),
  );
  const [status, setStatus] = useState<
    'idle' | 'submitting' | 'success' | 'error'
  >('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (open) {
      setTargetPrice(defaultTarget(currentPrice));
      setStatus('idle');
      setErrorMsg('');
    }
  }, [open, currentPrice]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (status !== 'success') return;
    const t = setTimeout(() => onClose(), 2500);
    return () => clearTimeout(t);
  }, [status, onClose]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'submitting') return;
    setStatus('submitting');
    setErrorMsg('');

    const result = await createPriceAlert({
      email,
      productSlug,
      productName,
      targetPrice,
      currentPrice,
      retailer,
    });

    if (result.ok) {
      setStatus('success');
      // GA4: matches event name fired by legacy PriceAlert.tsx so both
      // surfaces report under one event. Marked as key event in GA4 admin.
      if (typeof window !== 'undefined' && (window as { gtag?: (...args: unknown[]) => void }).gtag) {
        (window as { gtag: (...args: unknown[]) => void }).gtag('event', 'price_alert_set', {
          event_category: 'engagement',
          event_label: productName,
          value: targetPrice,
          currency: 'CAD',
          retailer: retailer ?? 'unknown',
          product_slug: productSlug,
        });
      }
    } else {
      setStatus('error');
      setErrorMsg(result.error);
    }
  }

  const belowCurrent = currentPrice <= 0 || targetPrice < currentPrice;
  const savings = currentPrice > 0 ? currentPrice - targetPrice : 0;
  const canSubmit =
    status !== 'submitting' && email.length > 0 && belowCurrent && targetPrice > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: 'rgba(0, 0, 0, 0.7)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="price-alert-title"
    >
      <div
        className="card w-full max-w-md p-6"
        style={{ boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-md"
              style={{
                background: 'var(--accent-glow)',
                border: '1px solid rgba(0, 229, 160, 0.3)',
              }}
            >
              <Bell className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h3
                id="price-alert-title"
                className="text-sm font-semibold"
                style={{ fontFamily: 'var(--font-sora)' }}
              >
                Set Price Alert
              </h3>
              <p
                className="text-[11px]"
                style={{ color: 'var(--text-secondary)' }}
              >
                We&rsquo;ll email you the moment this drops.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 transition hover:bg-white/5"
            style={{ color: 'var(--text-secondary)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {status === 'success' ? (
          <div
            className="mt-6 rounded-lg p-4 text-center"
            style={{
              background: 'rgba(0, 229, 160, 0.08)',
              border: '1px solid rgba(0, 229, 160, 0.3)',
            }}
          >
            <div
              className="mx-auto flex h-10 w-10 items-center justify-center rounded-full"
              style={{ background: 'var(--accent-glow)' }}
            >
              <Check className="h-5 w-5" style={{ color: 'var(--accent)' }} />
            </div>
            <div
              className="mt-3 text-sm font-medium"
              style={{ color: 'var(--text-primary)' }}
            >
              Alert set.
            </div>
            <div
              className="mt-1 text-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              We&rsquo;ll email <span style={{ color: 'var(--text-primary)' }}>{email}</span>{' '}
              when the price hits{' '}
              <span
                className="price-tag"
                style={{ fontSize: '0.75rem' }}
              >
                {fmtPrice(targetPrice)}
              </span>{' '}
              or lower.
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {/* Product context */}
            <div
              className="rounded-md px-3 py-2"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
              }}
            >
              <div
                className="truncate text-xs font-medium"
                style={{ color: 'var(--text-primary)' }}
              >
                {productName}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px]">
                {currentPrice > 0 && (
                  <>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Current:
                    </span>
                    <span
                      className="tabular-nums"
                      style={{
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-sora)',
                      }}
                    >
                      {fmtPrice(currentPrice)}
                    </span>
                  </>
                )}
                {retailer && (
                  <>
                    {currentPrice > 0 && (
                      <span style={{ color: 'var(--border)' }}>·</span>
                    )}
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {retailer}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Target price */}
            <div>
              <label
                htmlFor="target-price"
                className="mb-1.5 block text-[10px] uppercase tracking-wider"
                style={{
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-sora)',
                }}
              >
                Alert when price drops to
              </label>
              <div
                className="flex items-center rounded-md transition-colors"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                <span
                  className="pl-3 text-sm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  $
                </span>
                <input
                  id="target-price"
                  type="number"
                  value={targetPrice}
                  onChange={(e) => {
                    const raw = parseInt(e.target.value, 10);
                    setTargetPrice(
                      Number.isFinite(raw) ? Math.max(1, raw) : 0,
                    );
                  }}
                  min={1}
                  max={100_000}
                  required
                  className="w-full bg-transparent px-2 py-2.5 text-sm tabular-nums outline-none"
                  style={{
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-sora)',
                  }}
                />
                <span
                  className="pr-3 text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  CAD
                </span>
              </div>
              {currentPrice > 0 && !belowCurrent && (
                <div
                  className="mt-1.5 text-[10px]"
                  style={{ color: 'var(--danger)' }}
                >
                  Target must be below current price.
                </div>
              )}
              {currentPrice > 0 && belowCurrent && savings > 0 && (
                <div
                  className="mt-1.5 text-[10px]"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  You&rsquo;ll save{' '}
                  <span
                    className="tabular-nums"
                    style={{ color: 'var(--accent)' }}
                  >
                    {fmtPrice(savings)}
                  </span>{' '}
                  from current price.
                </div>
              )}
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="alert-email"
                className="mb-1.5 block text-[10px] uppercase tracking-wider"
                style={{
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-sora)',
                }}
              >
                Email address
              </label>
              <input
                id="alert-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                maxLength={254}
                autoComplete="email"
                className="w-full rounded-md px-3 py-2.5 text-sm outline-none"
                style={{
                  color: 'var(--text-primary)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                }}
              />
            </div>

            {status === 'error' && errorMsg && (
              <div
                className="rounded-md px-3 py-2 text-xs"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: 'var(--danger)',
                }}
              >
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="btn-primary flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === 'submitting' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Setting alert&hellip;
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4" />
                  Set Alert
                </>
              )}
            </button>

            <p
              className="text-center text-[10px]"
              style={{ color: 'var(--text-secondary)' }}
            >
              Free · Unsubscribe anytime · No spam.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
