'use client';

import { useState } from 'react';
import {
  linkExistingBoard,
  createNewBoard,
  rejectProposal,
  skipBoardProposal,
} from './actions';

interface CandidateBoard {
  entity_id: number;
  canonical_name: string;
  brand: string | null;
  score: number;
  shared_sku_token?: string | null;
  brand_match?: boolean;
  jaccard?: number;
  memory_gb?: number | null;
  product_line?: string | null;
  singleton_bonus?: boolean;
  [key: string]: unknown;
}

interface ProposedNewBoard {
  canonical_name?: string;
  brand?: string;
  memory_gb?: number;
  product_line?: string;
  [key: string]: unknown;
}

interface Props {
  proposalId: number;
  chipId: number;
  chipName: string | null;
  sourceTitle: string;
  sourceBrand: string | null;
  candidates: CandidateBoard[];
  proposedNewBoard: ProposedNewBoard | null;
}

const REJECT_REASONS = [
  { value: 'not_a_gpu', label: 'Not a GPU (capture card, dock, accessory)' },
  { value: 'duplicate_existing', label: 'Duplicate of existing canonical' },
  { value: 'scraper_error', label: 'Scraper error / garbled title' },
  { value: 'wrong_chip', label: 'Wrong chip resolved by cascade' },
  { value: 'other', label: 'Other' },
];

function scoreColor(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return 'text-slate-500';
  if (score >= 0.75) return 'text-emerald-400';
  if (score >= 0.5) return 'text-amber-400';
  return 'text-slate-500';
}

function formatScore(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return '—';
  return score.toFixed(3);
}

export function BoardActionPanel({
  proposalId,
  chipId,
  chipName,
  sourceTitle,
  sourceBrand,
  candidates,
  proposedNewBoard,
}: Props) {
  // Pre-fill the create-new form from proposed_new_board when present,
  // else from raw source title and brand.
  const [name, setName] = useState(
    proposedNewBoard?.canonical_name ?? sourceTitle ?? '',
  );
  const [brand, setBrand] = useState(
    proposedNewBoard?.brand ?? sourceBrand ?? '',
  );
  const [memoryGb, setMemoryGb] = useState(
    proposedNewBoard?.memory_gb !== undefined
      ? String(proposedNewBoard.memory_gb)
      : '',
  );
  const [productLine, setProductLine] = useState(
    proposedNewBoard?.product_line ?? '',
  );

  return (
    <div className="space-y-6">
      {/* ---- 1. Link to existing candidate ---- */}
      <section className="rounded-md border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-teal-400">
          Link to existing board
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          {candidates.length === 0
            ? 'No candidate boards under this chip.'
            : `${candidates.length} candidate board${candidates.length === 1 ? '' : 's'} under ${chipName ?? `chip ${chipId}`}, sorted by score.`}
        </p>

        {candidates.length > 0 && (
          <ul className="space-y-2">
            {candidates.map((c) => (
              <li
                key={c.entity_id}
                className="rounded border border-slate-800 bg-slate-950/50 p-3"
              >
                <div className="flex items-start gap-3">
                  <form action={linkExistingBoard} className="shrink-0">
                    <input
                      type="hidden"
                      name="proposal_id"
                      value={proposalId}
                    />
                    <input
                      type="hidden"
                      name="board_id"
                      value={c.entity_id}
                    />
                    <button
                      type="submit"
                      className="rounded bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-500"
                    >
                      Link
                    </button>
                  </form>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-slate-100">
                      {c.canonical_name}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400">
                      <span className="font-mono text-slate-500">
                        id {c.entity_id}
                      </span>
                      <span>
                        score:{' '}
                        <span className={`font-mono ${scoreColor(c.score)}`}>
                          {formatScore(c.score)}
                        </span>
                      </span>
                      {c.brand && (
                        <span>
                          brand:{' '}
                          <span className="font-mono">{c.brand}</span>
                        </span>
                      )}
                      {c.memory_gb != null && (
                        <span>
                          mem:{' '}
                          <span className="font-mono">{c.memory_gb}GB</span>
                        </span>
                      )}
                      {c.product_line && (
                        <span>
                          line:{' '}
                          <span className="font-mono">{c.product_line}</span>
                        </span>
                      )}
                      {c.shared_sku_token && (
                        <span>
                          sku:{' '}
                          <span className="font-mono">
                            {c.shared_sku_token}
                          </span>
                        </span>
                      )}
                      {c.singleton_bonus && (
                        <span className="text-emerald-400">singleton</span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- 2. Create new board ---- */}
      <section className="rounded-md border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-teal-400">
          Create new board canonical
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          Creates a new canonical_entity (entity_type=&apos;gpus&apos;,
          parent={chipId}) and links the listing to it. Per §3, memory_gb is a
          price-defining attribute on the leaf — not part of canonical_name.
        </p>

        <form action={createNewBoard} className="space-y-3">
          <input type="hidden" name="proposal_id" value={proposalId} />
          <input type="hidden" name="chip_id" value={chipId} />

          <div>
            <label
              htmlFor="canonical_name"
              className="mb-1 block text-xs uppercase tracking-wider text-slate-500"
            >
              canonical_name
            </label>
            <input
              id="canonical_name"
              name="canonical_name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 focus:border-teal-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="brand"
                className="mb-1 block text-xs uppercase tracking-wider text-slate-500"
              >
                brand
              </label>
              <input
                id="brand"
                name="brand"
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 focus:border-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="memory_gb"
                className="mb-1 block text-xs uppercase tracking-wider text-slate-500"
              >
                memory_gb
              </label>
              <input
                id="memory_gb"
                name="memory_gb"
                type="number"
                step="0.5"
                min="0"
                value={memoryGb}
                onChange={(e) => setMemoryGb(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 focus:border-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="product_line"
                className="mb-1 block text-xs uppercase tracking-wider text-slate-500"
              >
                product_line
              </label>
              <input
                id="product_line"
                name="product_line"
                type="text"
                placeholder="DUAL, AERO, VENTUS..."
                value={productLine}
                onChange={(e) => setProductLine(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Create new board &amp; link listing
          </button>
        </form>
      </section>

      {/* ---- 3. Reject ---- */}
      <section className="rounded-md border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-rose-400">
          Reject proposal
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          Marks the proposal rejected. Listing is NOT written to the new
          schema. Use for non-GPU listings, scraper errors, and duplicates.
        </p>

        <form action={rejectProposal} className="space-y-3">
          <input type="hidden" name="proposal_id" value={proposalId} />

          <div>
            <label
              htmlFor="reason"
              className="mb-1 block text-xs uppercase tracking-wider text-slate-500"
            >
              reason
            </label>
            <select
              id="reason"
              name="reason"
              defaultValue="not_a_gpu"
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-rose-500 focus:outline-none"
            >
              {REJECT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="rounded bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600"
          >
            Reject
          </button>
        </form>
      </section>

      {/* ---- 4. Skip ---- */}
      <section className="flex justify-end">
        <form action={skipBoardProposal}>
          <input type="hidden" name="proposal_id" value={proposalId} />
          <button
            type="submit"
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            Skip for this session →
          </button>
        </form>
      </section>
    </div>
  );
}
