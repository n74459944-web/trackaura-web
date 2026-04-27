'use client';

import Link from 'next/link';
import { Cpu, ArrowRight } from 'lucide-react';
import type { ChipParentData } from '@/lib/queries/enrichment';

/* ────────────────────────────────────────────────────────────────────────
   Theme — kept local so this component is self-contained. Mirrors the
   constants in ProductPage.tsx.
   ──────────────────────────────────────────────────────────────────────── */

const C = {
  bg: 'var(--bg-primary)',
  bgCard: 'var(--bg-card)',
  bgSecondary: 'var(--bg-secondary)',
  border: 'var(--border)',
  text: 'var(--text-primary)',
  textDim: 'var(--text-secondary)',
  accent: 'var(--accent)',
};
const FONT_DISPLAY = 'var(--font-sora)';

const fmtReleaseYear = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { month: 'short', year: 'numeric' });
};

/* ────────────────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────────────────── */

export default function ChipParentSection({
  chip,
}: {
  chip: ChipParentData;
}) {
  const releaseLabel = fmtReleaseYear(chip.releaseDate);
  // Group attributes by their semantic group for visual chunking.
  const groupedAttrs = chip.attributes.reduce<Record<string, typeof chip.attributes>>(
    (acc, attr) => {
      (acc[attr.group] ??= []).push(attr);
      return acc;
    },
    {},
  );
  const groupKeys = Object.keys(groupedAttrs);

  // Only show siblings with a legacy slug (otherwise they 404 on click).
  const linkableSiblings = chip.siblings.filter((s) => s.legacySlug != null);
  const hiddenSiblingCount =
    chip.totalBoardCount - 1 - linkableSiblings.length;

  return (
    <section style={{ borderBottom: `1px solid ${C.border}` }}>
      <div className="mx-auto max-w-[1400px] px-4 py-6">
        {/* Header */}
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div
              className="flex items-center gap-2 text-[10px] uppercase tracking-wider"
              style={{ color: C.textDim, fontFamily: FONT_DISPLAY }}
            >
              <Cpu className="h-3 w-3" />
              Built On
            </div>
            <h2
              className="mt-1 flex flex-wrap items-baseline gap-2 text-lg font-semibold"
              style={{ color: C.text, fontFamily: FONT_DISPLAY }}
            >
              {chip.canonicalName}
              {chip.brand && (
                <span
                  className="text-xs font-normal uppercase tracking-wider"
                  style={{ color: C.textDim }}
                >
                  {chip.brand}
                </span>
              )}
            </h2>
          </div>
          {(releaseLabel || chip.msrpCad != null) && (
            <div
              className="flex flex-wrap gap-3 text-[11px]"
              style={{ color: C.textDim, fontFamily: FONT_DISPLAY }}
            >
              {releaseLabel && (
                <span>
                  Released{' '}
                  <span style={{ color: C.text }}>{releaseLabel}</span>
                </span>
              )}
              {chip.msrpCad != null && (
                <span>
                  Launch MSRP{' '}
                  <span style={{ color: C.text }}>
                    ${Math.round(chip.msrpCad).toLocaleString('en-CA')}
                  </span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Attribute grid */}
        {chip.attributes.length > 0 && (
          <div
            className="overflow-hidden rounded-lg"
            style={{
              border: `1px solid ${C.border}`,
              background: C.bgCard,
            }}
          >
            {groupKeys.map((group, gi) => (
              <div
                key={group}
                style={{
                  borderTop: gi > 0 ? `1px solid ${C.border}` : 'none',
                }}
              >
                <div
                  className="px-4 py-2 text-[10px] uppercase tracking-wider"
                  style={{
                    background: C.bgSecondary,
                    color: C.textDim,
                    fontFamily: FONT_DISPLAY,
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  {group}
                </div>
                <dl
                  className="grid gap-px"
                  style={{
                    gridTemplateColumns:
                      'repeat(auto-fill, minmax(200px, 1fr))',
                    background: C.border,
                  }}
                >
                  {groupedAttrs[group].map((attr) => (
                    <div
                      key={attr.key}
                      className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-xs"
                      style={{ background: C.bgCard }}
                    >
                      <dt style={{ color: C.textDim }}>{attr.label}</dt>
                      <dd
                        className="truncate text-right tabular-nums"
                        style={{ color: C.text, fontFamily: FONT_DISPLAY }}
                      >
                        {attr.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        )}

        {/* Sibling boards strip */}
        {linkableSiblings.length > 0 && (
          <div className="mt-4">
            <div
              className="mb-2 flex items-center justify-between text-[11px]"
              style={{ color: C.textDim, fontFamily: FONT_DISPLAY }}
            >
              <span>
                Other {chip.canonicalName.replace(/^(NVIDIA|AMD|Intel)\s+/, '')}{' '}
                boards
              </span>
              {chip.totalBoardCount > 1 && (
                <span>{chip.totalBoardCount} total</span>
              )}
            </div>
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              }}
            >
              {linkableSiblings.map((sib) => (
                <Link
                  key={sib.entityId}
                  href={`/p/${sib.legacySlug}`}
                  className="card group flex items-start justify-between gap-2 px-3 py-2.5"
                  style={{
                    borderRadius: 8,
                    textDecoration: 'none',
                  }}
                >
                  <div className="min-w-0 flex-1">
                    {sib.brand && (
                      <div
                        className="text-[9px] uppercase tracking-wider"
                        style={{
                          color: C.textDim,
                          fontFamily: FONT_DISPLAY,
                        }}
                      >
                        {sib.brand}
                      </div>
                    )}
                    <div
                      className="text-xs font-medium leading-snug"
                      style={{
                        color: C.text,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {sib.name}
                    </div>
                  </div>
                  <ArrowRight
                    className="h-3.5 w-3.5 shrink-0 transition-opacity group-hover:opacity-100"
                    style={{ color: C.textDim, opacity: 0.5 }}
                  />
                </Link>
              ))}
            </div>
            {hiddenSiblingCount > 0 && (
              <p
                className="mt-2 text-[11px]"
                style={{ color: C.textDim, fontFamily: FONT_DISPLAY }}
              >
                +{hiddenSiblingCount} more board
                {hiddenSiblingCount === 1 ? '' : 's'} tracked under this chip.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
