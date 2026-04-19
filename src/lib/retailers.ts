/**
 * Central retailer config. Scrapers store `retailer` as free-text on
 * the products table; this file normalizes those strings into canonical
 * keys and attaches UI metadata (color, short code).
 *
 * Colors match the existing --cc-color and --newegg-color CSS variables
 * in globals.css so retailer badges stay consistent across the site.
 */

export type RetailerKey =
  | 'canadaComputers'
  | 'newegg'
  | 'bestBuy'
  | 'memoryExpress'
  | 'vuugo'
  | 'visions'
  | 'unknown';

export type RetailerConfig = {
  id: RetailerKey;
  name: string;
  short: string;
  color: string;
};

export const RETAILERS: Record<RetailerKey, RetailerConfig> = {
  canadaComputers: {
    id: 'canadaComputers',
    name: 'Canada Computers',
    short: 'CC',
    color: '#e63946', // --cc-color
  },
  newegg: {
    id: 'newegg',
    name: 'Newegg Canada',
    short: 'NE',
    color: '#f77f00', // --newegg-color
  },
  bestBuy: {
    id: 'bestBuy',
    name: 'Best Buy Canada',
    short: 'BB',
    color: '#0046be',
  },
  memoryExpress: {
    id: 'memoryExpress',
    name: 'Memory Express',
    short: 'ME',
    color: '#7c3aed',
  },
  vuugo: {
    id: 'vuugo',
    name: 'Vuugo',
    short: 'VG',
    color: '#00e5a0', // --accent (neutral house color)
  },
  visions: {
    id: 'visions',
    name: 'Visions Electronics',
    short: 'VS',
    color: '#38bdf8',
  },
  unknown: {
    id: 'unknown',
    name: 'Unknown',
    short: '??',
    color: '#8994a7', // --text-secondary
  },
};

/**
 * Normalize free-text retailer strings to a canonical RetailerConfig.
 * Add new matchers here as scrapers come online.
 */
export function resolveRetailer(raw: string | null | undefined): RetailerConfig {
  if (!raw) return RETAILERS.unknown;
  const s = raw.toLowerCase().trim();

  if (s.includes('canada computers') || s === 'cc' || s === 'canadacomputers')
    return RETAILERS.canadaComputers;
  if (s.includes('newegg')) return RETAILERS.newegg;
  if (s.includes('best buy') || s.includes('bestbuy')) return RETAILERS.bestBuy;
  if (s.includes('memory express') || s.includes('memoryexpress'))
    return RETAILERS.memoryExpress;
  if (s.includes('vuugo')) return RETAILERS.vuugo;
  if (s.includes('visions')) return RETAILERS.visions;

  // Unknown retailer — preserve original label so the UI still shows something recognizable.
  return { ...RETAILERS.unknown, name: raw };
}
