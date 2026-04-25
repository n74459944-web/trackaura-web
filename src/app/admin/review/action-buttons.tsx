'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  approveParent,
  skipBoard,
  suggestChip,
  createChipFromProposal,
  type SuggestResult,
} from './actions';

type ChipCandidate = {
  id: number;
  canonical_name: string;
  brand: string | null;
  similarity: number;
};

export function ActionButtons({
  boardId,
  boardName,
  candidates,
  isSearchMode,
}: {
  boardId: number;
  boardName: string;
  candidates: ChipCandidate[];
  isSearchMode: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<SuggestResult | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  function handleApprove(chipId: number) {
    startTransition(async () => {
      await approveParent(boardId, chipId);
      setSuggestion(null);
      setSuggestError(null);
      router.push('/admin/review');
    });
  }

  function handleSkip() {
    startTransition(async () => {
      await skipBoard(boardId);
      setSuggestion(null);
      setSuggestError(null);
      router.push('/admin/review');
    });
  }

  async function handleSuggest() {
    setSuggestError(null);
    setSuggestion(null);
    setIsSuggesting(true);
    try {
      const result = await suggestChip(boardId, boardName);
      setSuggestion(result);
    } catch (err) {
      setSuggestError(
        'Suggest failed: ' +
          (err instanceof Error ? err.message : 'Unknown error'),
      );
    } finally {
      setIsSuggesting(false);
    }
  }

  function handleCreateNewChip() {
    if (!suggestion) return;
    const { chip_name, reasoning } = suggestion.suggestion;
    if (!chip_name) return;

    setSuggestError(null);
    startTransition(async () => {
      try {
        await createChipFromProposal(boardId, chip_name, reasoning);
        setSuggestion(null);
        router.push('/admin/review');
      } catch (err) {
        setSuggestError(
          'Create chip failed: ' +
            (err instanceof Error ? err.message : 'Unknown error'),
        );
      }
    });
  }

  const confidenceColor =
    suggestion && suggestion.suggestion.confidence >= 0.8
      ? 'text-teal-400'
      : suggestion && suggestion.suggestion.confidence >= 0.5
      ? 'text-yellow-400'
      : 'text-red-400';

  return (
    <div className="space-y-2">
      {/* AI suggest control */}
      <div className="mb-3 flex items-center gap-3">
        <button
          onClick={handleSuggest}
          disabled={isSuggesting || isPending}
          className="px-3 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded transition"
        >
          {isSuggesting ? 'Thinking…' : 'AI suggest'}
        </button>
        <span className="text-xs text-neutral-500">
          Ask Claude to decode the model code
        </span>
      </div>

      {suggestError ? (
        <div className="mb-3 px-3 py-2 border border-red-900 bg-red-950/30 rounded text-sm text-red-300">
          {suggestError}
        </div>
      ) : null}

      {suggestion ? (
        <div className="mb-4 border border-indigo-800 bg-indigo-950/30 rounded p-3 space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-xs uppercase tracking-wide text-indigo-400 font-medium">
              AI suggestion
            </div>
            <div className={`text-xs font-mono ${confidenceColor}`}>
              confidence {suggestion.suggestion.confidence.toFixed(2)}
            </div>
          </div>
          <div className="text-sm text-neutral-100">
            <span className="font-medium">
              {suggestion.suggestion.chip_name || '(no chip identified)'}
            </span>
          </div>
          <div className="text-xs text-neutral-400 italic">
            {suggestion.suggestion.reasoning}
          </div>

          {suggestion.matches.length > 0 ? (
            <div className="pt-2 border-t border-indigo-900 space-y-1.5">
              {suggestion.matches.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 px-2 py-1.5 bg-neutral-900 rounded"
                >
                  <button
                    onClick={() => handleApprove(m.id)}
                    disabled={isPending}
                    className="px-3 py-1 text-xs font-medium bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed rounded flex-shrink-0 transition"
                  >
                    Approve
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-neutral-100 truncate">
                      {m.canonical_name}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {m.brand ?? '—'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : suggestion.suggestion.is_new_chip_proposal &&
            suggestion.suggestion.chip_name ? (
            <div className="pt-2 border-t border-indigo-900">
              <div className="flex items-center gap-3 px-2 py-1.5 bg-neutral-900 rounded">
                <button
                  onClick={handleCreateNewChip}
                  disabled={isPending}
                  className="px-3 py-1 text-xs font-medium bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed rounded flex-shrink-0 transition"
                >
                  Create
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-neutral-100 truncate">
                    {suggestion.suggestion.chip_name}
                  </div>
                  <div className="text-xs text-neutral-500">
                    New chip · not yet in catalog
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-neutral-500 pt-2 border-t border-indigo-900">
              No chip matching &ldquo;{suggestion.suggestion.chip_name}&rdquo;
              in the catalog. Use the search box manually or skip.
            </div>
          )}
        </div>
      ) : null}

      {/* Regular candidate list */}
      {candidates.map((c) => {
        const isWeak = !isSearchMode && c.similarity < 0.3;
        return (
          <div
            key={c.id}
            className={`flex items-center gap-3 px-3 py-2 border rounded transition ${
              isWeak
                ? 'border-neutral-900 bg-neutral-950'
                : 'border-neutral-800 hover:border-neutral-700'
            }`}
          >
            <button
              onClick={() => handleApprove(c.id)}
              disabled={isPending}
              className="px-3 py-1 text-xs font-medium bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed rounded flex-shrink-0 transition"
            >
              Approve
            </button>
            <div className="flex-1 min-w-0">
              <div
                className={`text-sm truncate ${
                  isWeak ? 'text-neutral-500' : 'text-neutral-100'
                }`}
              >
                {c.canonical_name}
              </div>
              <div className="text-xs text-neutral-500">
                {c.brand ?? '—'} · similarity{' '}
                <span className="font-mono">{c.similarity.toFixed(2)}</span>
              </div>
            </div>
          </div>
        );
      })}

      <div className="pt-4">
        <button
          onClick={handleSkip}
          disabled={isPending}
          className="w-full px-3 py-2 text-sm text-neutral-400 hover:text-neutral-100 border border-neutral-800 hover:border-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed rounded transition"
        >
          Skip &mdash; can&apos;t find a good match
        </button>
      </div>
    </div>
  );
}
