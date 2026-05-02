// src/lib/chip/get-chip-view-model.ts
//
// Builds the full view model for /chip/[slug]. Four queries:
//   1. Boards under the chip (canonical_entities WHERE parent_entity_id = chip.id)
//   2. Active listings for those boards
//   3. Recent price_observations for those listings (last 30d, latest per listing)
//
// is_in_stock is intentionally ignored — see ARCHITECTURE.md §11 risk 20. Any
// active listing with a recent observation is treated as "current price" until
// the observations writer is patched.
//
// getChipViewModel is wrapped with React.cache so generateMetadata and the
// page render dedupe their lookups within a single request. The cache key is
// the chip object reference, so this only dedupes correctly when both call
// sites pass the same reference. resolveChipBySlug is also React.cache'd, so
// the chip extracted from its result is the same reference across the two
// calls — wrapping just one of the two functions wouldn't be enough.

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { ChipEntity } from './slug-resolver';

const OBSERVATION_LOOKBACK_DAYS = 30;

export type BoardListing = {
  listing_id: string;
  retailer: string;
  url: string;
  current_price: number | null;
  observed_at: string | null;
  match_confidence: number | null;
  last_seen: string | null;
};

export type Board = {
  id: string;
  slug: string;
  canonical_name: string;
  display_name: string | null;
  brand: string | null;
  listings: BoardListing[];
  lowest_price: number | null;
  retailer_count: number;
};

export type ChipStats = {
  board_count: number;
  active_listing_count: number;
  retailer_count: number;
  lowest_price: number | null;
  last_observation_at: string | null;
};

export type ChipViewModel = {
  chip: ChipEntity;
  boards: Board[];
  stats: ChipStats;
};

export const getChipViewModel = cache(
  async (chip: ChipEntity): Promise<ChipViewModel> => {
    const supabase = await createClient();

    // 1. Boards under this chip.
    const { data: boardsRaw } = await supabase
      .from('canonical_entities')
      .select('id, slug, canonical_name, display_name, brand')
      .eq('parent_entity_id', chip.id)
      .eq('entity_type', 'gpus');

    const boards = boardsRaw ?? [];

    if (boards.length === 0) {
      return { chip, boards: [], stats: emptyStats() };
    }

    const boardIds = boards.map((b) => b.id);

    // 2. Active listings for all boards.
    const { data: listingsRaw } = await supabase
      .from('listings')
      .select('id, entity_id, retailer, url, last_seen, match_confidence')
      .in('entity_id', boardIds)
      .eq('is_active', true);

    const listings = listingsRaw ?? [];

    if (listings.length === 0) {
      return {
        chip,
        boards: boards.map((b) => ({
          ...b,
          listings: [],
          lowest_price: null,
          retailer_count: 0,
        })),
        stats: { ...emptyStats(), board_count: boards.length },
      };
    }

    // 3. Recent price observations, latest-per-listing computed in JS.
    const listingIds = listings.map((l) => l.id);
    const since = new Date(
      Date.now() - OBSERVATION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: observations } = await supabase
      .from('price_observations')
      .select('listing_id, price, observed_at')
      .in('listing_id', listingIds)
      .gte('observed_at', since)
      .order('observed_at', { ascending: false });

    const latestByListing = new Map<
      string,
      { price: number; observed_at: string }
    >();
    for (const obs of observations ?? []) {
      if (!latestByListing.has(obs.listing_id)) {
        latestByListing.set(obs.listing_id, {
          price: obs.price,
          observed_at: obs.observed_at,
        });
      }
    }

    // 4. Assemble per-board structure.
    const boardMap = new Map<string, Board>();
    for (const b of boards) {
      boardMap.set(b.id, {
        ...b,
        listings: [],
        lowest_price: null,
        retailer_count: 0,
      });
    }

    for (const listing of listings) {
      const board = boardMap.get(listing.entity_id);
      if (!board) continue;
      const latest = latestByListing.get(listing.id);
      board.listings.push({
        listing_id: listing.id,
        retailer: listing.retailer,
        url: listing.url,
        current_price: latest?.price ?? null,
        observed_at: latest?.observed_at ?? null,
        match_confidence: listing.match_confidence,
        last_seen: listing.last_seen,
      });
    }

    // Per-board aggregates + sort listings by current price (nulls last).
    for (const board of boardMap.values()) {
      const prices = board.listings
        .map((l) => l.current_price)
        .filter((p): p is number => p !== null);
      board.lowest_price = prices.length > 0 ? Math.min(...prices) : null;
      board.retailer_count = new Set(board.listings.map((l) => l.retailer)).size;
      board.listings.sort(comparePriceAsc);
    }

    // Sort boards by lowest price (nulls last).
    const sortedBoards = Array.from(boardMap.values()).sort(
      compareBoardPriceAsc,
    );

    // Chip-level aggregates.
    const allPrices = sortedBoards
      .flatMap((b) => b.listings.map((l) => l.current_price))
      .filter((p): p is number => p !== null);
    const allRetailers = new Set(listings.map((l) => l.retailer));
    const allObservedAt = sortedBoards
      .flatMap((b) => b.listings.map((l) => l.observed_at))
      .filter((d): d is string => d !== null);

    return {
      chip,
      boards: sortedBoards,
      stats: {
        board_count: boards.length,
        active_listing_count: listings.length,
        retailer_count: allRetailers.size,
        lowest_price: allPrices.length > 0 ? Math.min(...allPrices) : null,
        last_observation_at:
          allObservedAt.length > 0 ? allObservedAt.sort().reverse()[0] : null,
      },
    };
  },
);

function emptyStats(): ChipStats {
  return {
    board_count: 0,
    active_listing_count: 0,
    retailer_count: 0,
    lowest_price: null,
    last_observation_at: null,
  };
}

function comparePriceAsc(a: BoardListing, b: BoardListing): number {
  if (a.current_price === null && b.current_price === null) return 0;
  if (a.current_price === null) return 1;
  if (b.current_price === null) return -1;
  return a.current_price - b.current_price;
}

function compareBoardPriceAsc(a: Board, b: Board): number {
  if (a.lowest_price === null && b.lowest_price === null) return 0;
  if (a.lowest_price === null) return 1;
  if (b.lowest_price === null) return -1;
  return a.lowest_price - b.lowest_price;
}
