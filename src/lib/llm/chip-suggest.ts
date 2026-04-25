/**
 * Candidate-aware chip identification (ARCHITECTURE.md §4 Tier 3).
 *
 * Target path: C:\dev\trackaura-web\lib\llm\chip-suggest.ts
 *
 * Given a GPU board listing name AND a shortlist of candidate chips from
 * our catalog, Claude Haiku picks which candidate is the underlying
 * silicon — or proposes a new chip if none fit.
 *
 * Rationale: isolation-mode calls failed in the 2026-04-22 session on:
 *   - Retailer typos  (ZOTAC 'RX3060-12GD6' → invented 'counterfeit' theory)
 *   - New products   (RTX PRO 2000/5000 Blackwell → guessed RTX A5000)
 *   - Workstation    (AMD Radeon AI Pro R9700 → guessed W9700)
 *   - Near-miss names (real chip was one step down the fuzzy list)
 * Candidate-aware mode fixes all four: the LLM picks from a real list
 * instead of imagining names, and only proposes new when no candidate fits.
 */

import Anthropic from '@anthropic-ai/sdk';
import { checkBudget, recordCall } from './budget';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MODEL = 'claude-haiku-4-5-20251001';
const PROVIDER = 'anthropic';
const PURPOSE = 'chip_suggest';

export type ChipCandidate = {
  id: number;
  canonical_name: string;
  brand: string | null;
};

export type ChipSuggestion = {
  /** ID from the CANDIDATES list, or null if none fit. */
  matched_chip_id: number | null;
  /** 0.0–1.0. Below 0.7 means ambiguous or uncertain. */
  confidence: number;
  /** Populated only when matched_chip_id is null and the listing is
   *  clearly a real chip missing from our catalog. */
  new_chip_proposal: { chip_name: string } | null;
  /** Short human-readable explanation of the decision. */
  reasoning: string;
};

const SYSTEM_PROMPT = `You identify the GPU chip inside a retailer's product listing, given a shortlist of candidate chips from our catalog.

Return JSON exactly matching this shape:
{
  "matched_chip_id": 123,              // id from CANDIDATES, or null
  "confidence": 0.0,                   // 0.0 to 1.0
  "new_chip_proposal": null,           // OR {"chip_name": "..."} if no candidate fits
  "reasoning": "short explanation"
}

Rules:
1. Prefer candidates. Only set new_chip_proposal when no candidate plausibly matches the same silicon.
2. Board-level attributes are NOT part of the chip identity. Ignore:
   - Memory size (8GB, 12GB, 16GB, 24GB)
   - Cooler / model line (WindForce, TUF, ROG Strix, Gaming Trio, AORUS, Twin Edge, Ventus, etc.)
   - Partner brand (ASUS, MSI, GIGABYTE, ZOTAC, EVGA, PNY, etc.)
   - OC / factory clock status
   - Colour variants (White, Black, OC Edition, etc.)
3. Retailer typos are common. If a listing says "GeForce RTX 3060" in one place and "RX3060" in another (ZOTAC does this), it is an NVIDIA RTX 3060 — not AMD. Match on the explicit chip name in the listing text.
4. Ambiguous between 2+ candidates: pick the best guess and set confidence 0.6–0.8.
5. Non-GPU listings (mining rig frame, GPU riser cable, PSU bundle, backplate only) → matched_chip_id=null, new_chip_proposal=null, confidence<0.3.
6. New chip proposals must follow canonical naming:
   - NVIDIA consumer: "NVIDIA GeForce <family> <number> [Ti|Super|Ti Super]"
   - NVIDIA pro:      "NVIDIA RTX PRO <number> [Blackwell|Ada|Ampere]" or "NVIDIA Quadro <model>"
   - AMD consumer:    "AMD Radeon <family> <number> [XT|XTX]"
   - AMD pro:         "AMD Radeon Pro <identifier>" or "AMD Radeon AI Pro <identifier>"
   - Intel:           "Intel Arc <family> <number>"`;

export async function suggestChipFromBoardName(
  boardName: string,
  candidates: ChipCandidate[],
): Promise<ChipSuggestion> {
  // Budget check throws BudgetExceededError if breaker is open.
  await checkBudget();

  const candidatesJson = JSON.stringify(
    candidates.map((c) => ({
      id: c.id,
      name: c.canonical_name,
      brand: c.brand,
    })),
  );

  const userContent = `LISTING: ${boardName}

CANDIDATES: ${candidatesJson}

Return JSON only.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: userContent },
      // Prefill '{' forces Haiku to continue JSON without preamble
      { role: 'assistant', content: '{' },
    ],
  });

  // Log cost fire-and-forget — never block the response on logging failures.
  recordCall({
    provider: PROVIDER,
    model: MODEL,
    purpose: PURPOSE,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    metadata: {
      boardName,
      candidate_count: candidates.length,
      candidate_ids: candidates.map((c) => c.id),
    },
  }).catch((e) => console.error('[chip-suggest] recordCall failed:', e));

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('LLM returned no text content');
  }

  const raw = '{' + textBlock.text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`LLM returned invalid JSON: ${raw.slice(0, 300)}`);
  }

  return validateSuggestion(parsed, candidates);
}

/**
 * Validate + sanity-check the parsed response. Critically: if the LLM
 * returns a matched_chip_id not in the candidate list (hallucinated id),
 * we downgrade to null. This is the whole point of moving off isolation
 * mode — we never want a chip id we can't verify exists.
 */
function validateSuggestion(
  parsed: unknown,
  candidates: ChipCandidate[],
): ChipSuggestion {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(
      `LLM returned non-object: ${JSON.stringify(parsed).slice(0, 200)}`,
    );
  }
  const p = parsed as Record<string, unknown>;

  const matched_chip_id =
    p.matched_chip_id === null || typeof p.matched_chip_id === 'number'
      ? (p.matched_chip_id as number | null)
      : null;

  const confidence = typeof p.confidence === 'number' ? p.confidence : 0;

  let new_chip_proposal: { chip_name: string } | null = null;
  if (
    p.new_chip_proposal !== null &&
    p.new_chip_proposal !== undefined &&
    typeof p.new_chip_proposal === 'object'
  ) {
    const proposal = p.new_chip_proposal as Record<string, unknown>;
    if (typeof proposal.chip_name === 'string' && proposal.chip_name.trim()) {
      new_chip_proposal = { chip_name: proposal.chip_name.trim() };
    }
  }

  const reasoning =
    typeof p.reasoning === 'string' ? p.reasoning : '(no reasoning provided)';

  // Sanity: a matched_chip_id MUST exist in the candidate list.
  if (matched_chip_id !== null) {
    const exists = candidates.some((c) => c.id === matched_chip_id);
    if (!exists) {
      console.warn(
        `[chip-suggest] LLM returned matched_chip_id=${matched_chip_id} not in candidates; nulling out`,
      );
      return {
        matched_chip_id: null,
        confidence: Math.min(confidence, 0.5),
        new_chip_proposal,
        reasoning: `[LLM returned invalid chip id] ${reasoning}`,
      };
    }
  }

  return { matched_chip_id, confidence, new_chip_proposal, reasoning };
}
