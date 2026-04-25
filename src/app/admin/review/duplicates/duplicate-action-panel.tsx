'use client';

import {
  mergeKeepA,
  mergeKeepB,
  rejectNotDuplicate,
  skipDuplicate,
} from './actions';

interface Pair {
  id: number;
  a_entity_id: number;
  b_entity_id: number;
  similarity: number;
  a_canonical_name: string;
  b_canonical_name: string;
  a_listings_count: number;
  b_listings_count: number;
  a_price_obs_count: number;
  b_price_obs_count: number;
  priority: number;
}

const REJECT_REASONS = [
  {
    value: 'legitimate_variants',
    label: 'Legitimate variants (different memory, condition, etc.)',
  },
  {
    value: 'different_chips',
    label: 'Different chips (similar names, distinct silicon)',
  },
  { value: 'false_positive', label: 'Detection rule false positive' },
  { value: 'needs_more_data', label: 'Uncertain — defer for now' },
  { value: 'other', label: 'Other' },
];

interface CardProps {
  side: 'A' | 'B';
  name: string;
  id: number;
  listings: number;
  obs: number;
}

function EntityCard({ side, name, id, listings, obs }: CardProps) {
  return (
    <div className="rounded border border-slate-800 bg-slate-950/50 p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-mono text-xs uppercase tracking-wider text-teal-400">
          Entity {side}
        </span>
        <span className="font-mono text-xs text-slate-500">id {id}</span>
      </div>
      <div className="mb-3 break-words text-sm text-slate-100">{name}</div>
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
        <div>
          <span className="text-slate-500">listings:</span>{' '}
          <span className="font-mono">{listings}</span>
        </div>
        <div>
          <span className="text-slate-500">price obs:</span>{' '}
          <span className="font-mono">{obs}</span>
        </div>
      </div>
    </div>
  );
}

function describeMergeImpact(listings: number, obs: number): string {
  if (listings === 0 && obs === 0) {
    return 'is empty — clean delete';
  }
  const parts: string[] = [];
  if (listings > 0) {
    parts.push(`${listings} listing${listings === 1 ? '' : 's'}`);
  }
  if (obs > 0) {
    parts.push(`${obs} obs`);
  }
  return `has ${parts.join(', ')} — will move to survivor`;
}

export function DuplicateActionPanel({ pair }: { pair: Pair }) {
  const aImpact = describeMergeImpact(
    pair.a_listings_count,
    pair.a_price_obs_count,
  );
  const bImpact = describeMergeImpact(
    pair.b_listings_count,
    pair.b_price_obs_count,
  );

  return (
    <div className="space-y-6">
      {/* ---- Side-by-side ---- */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <EntityCard
          side="A"
          name={pair.a_canonical_name}
          id={pair.a_entity_id}
          listings={pair.a_listings_count}
          obs={pair.a_price_obs_count}
        />
        <EntityCard
          side="B"
          name={pair.b_canonical_name}
          id={pair.b_entity_id}
          listings={pair.b_listings_count}
          obs={pair.b_price_obs_count}
        />
      </section>

      {/* ---- 1. Merge ---- */}
      <section className="rounded-md border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-teal-400">
          Merge
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          The kept entity (target) absorbs all listings, price observations,
          attributes, and source mappings from the deleted entity (source). The
          source canonical_entity is removed. This action is atomic but
          irreversible — `legacy_source_db = &apos;merged_into:&lt;id&gt;&apos;`
          on the survivor records the merged-from id for audit.
        </p>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <form action={mergeKeepA}>
            <input type="hidden" name="pair_id" value={pair.id} />
            <button
              type="submit"
              className="w-full rounded bg-teal-600 px-4 py-3 text-left text-sm font-medium text-white hover:bg-teal-500"
            >
              <div>Keep A · delete B</div>
              <div className="mt-1 font-mono text-xs font-normal opacity-80">
                B {bImpact}
              </div>
            </button>
          </form>
          <form action={mergeKeepB}>
            <input type="hidden" name="pair_id" value={pair.id} />
            <button
              type="submit"
              className="w-full rounded bg-teal-600 px-4 py-3 text-left text-sm font-medium text-white hover:bg-teal-500"
            >
              <div>Keep B · delete A</div>
              <div className="mt-1 font-mono text-xs font-normal opacity-80">
                A {aImpact}
              </div>
            </button>
          </form>
        </div>
      </section>

      {/* ---- 2. Not a duplicate ---- */}
      <section className="rounded-md border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-rose-400">
          Not a duplicate
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          Marks the pair rejected. Both entities are preserved; the pair is
          removed from the queue. Use for legitimate variants the detector
          over-merged, or for genuine detection false positives.
        </p>

        <form action={rejectNotDuplicate} className="space-y-3">
          <input type="hidden" name="pair_id" value={pair.id} />

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
              defaultValue="legitimate_variants"
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
            Mark not a duplicate
          </button>
        </form>
      </section>

      {/* ---- 3. Skip ---- */}
      <section className="flex justify-end">
        <form action={skipDuplicate}>
          <input type="hidden" name="pair_id" value={pair.id} />
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
