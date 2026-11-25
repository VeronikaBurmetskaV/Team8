/* ---------- «Бренди» block of the home page (BrandTiles.tsx) ---------- */

import type { BrandSummary } from "../../api/types";
import { brandKey, type BrandOption } from "./catalog";

/** Rows shown before «Усі бренди (N)». */
export const BRAND_TILE_ROWS = 2;

/**
 * Tiles per row: 3 on a phone, 4 from --bp-tablet, 6 from --bp-desktop, 8 from 1440 px
 * (the wide container of index.css). BrandTiles.module.css repeats the same numbers.
 */
export const BRAND_TILE_MEDIA = {
  tablet: "(min-width: 768px)",
  desktop: "(min-width: 1024px)",
  wide: "(min-width: 1440px)",
} as const;

export function brandTileColumns(matches: {
  tablet: boolean;
  desktop: boolean;
  wide: boolean;
}): number {
  if (matches.wide) return 8;
  if (matches.desktop) return 6;
  if (matches.tablet) return 4;
  return 3;
}

/** The tiles in view: all when expanded, otherwise the first BRAND_TILE_ROWS rows. */
export function visibleBrandTiles(
  options: readonly BrandOption[],
  columns: number,
  expanded: boolean,
): readonly BrandOption[] {
  return expanded ? options : options.slice(0, columns * BRAND_TILE_ROWS);
}

/** «Усі бренди (N)» exists only when the brands do not fit into BRAND_TILE_ROWS rows. */
export function hasHiddenBrandTiles(
  options: readonly BrandOption[],
  columns: number,
): boolean {
  return options.length > columns * BRAND_TILE_ROWS;
}

/**
 * The block is shown only on the "clean" home page: no active filter, no brand page, and
 * the catalogue is loading (skeleton) or has at least one brand. Hidden on a load error.
 */
export function showBrandTiles(state: {
  status: "pending" | "error" | "success";
  activeFilters: number;
  singleBrandView: boolean;
  brandCount: number;
}): boolean {
  if (state.activeFilters > 0 || state.singleBrandView) return false;
  if (state.status === "pending") return true;
  return state.status === "success" && state.brandCount > 0;
}

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/**
 * 1–2 letters for the tile: the first letters of the first two words («Lucky Humanoid» →
 * «LH»), or the first two letters of a one-word name («Barricade» → «BA», «CHER'17» →
 * «CH»). Apostrophes, dashes and other signs are skipped; digits count only when a word has
 * no letters. Upper case, Ukrainian rules.
 */
export function monogram(name: string): string {
  const words = name
    .trim()
    .split(/[\s\-–—_/.&+]+/u)
    .map(wordSymbols)
    .filter((symbols) => symbols.length > 0);
  const [first, second] = words;
  if (first === undefined) return "";
  const letters =
    second === undefined
      ? first.slice(0, 2).join("")
      : `${first[0] ?? ""}${second[0] ?? ""}`;
  return letters.toLocaleUpperCase("uk");
}

/** Letters of a word in order, or its digits when it has no letters (code points). */
function wordSymbols(word: string): string[] {
  const symbols = [...word].filter((char) => LETTER_OR_DIGIT.test(char));
  const letters = symbols.filter((char) => /\p{L}/u.test(char));
  return letters.length > 0 ? letters : symbols;
}

/** Monogram background/text pairs: CSS variables of tokens.css (all ≥ 4.5:1). */
export const MONOGRAM_COLORS = [
  "brown",
  "beige",
  "warm-gray",
  "olive",
  "green",
  "khaki",
] as const;

export type MonogramColor = (typeof MONOGRAM_COLORS)[number];

/** FNV-1a over the UTF-16 code units: small, fast and the same in every browser. */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

/** The colour of a brand's monogram: always the same for the same brandKey. */
export function brandColor(key: string): MonogramColor {
  return MONOGRAM_COLORS[hash(key) % MONOGRAM_COLORS.length] ?? "olive";
}

/** CSS custom properties for a tile: background and text of its monogram. */
export function monogramStyle(key: string): Record<string, string> {
  const color = brandColor(key);
  return {
    "--monogram-bg": `var(--monogram-${color}-bg)`,
    "--monogram-fg": `var(--monogram-${color}-fg)`,
  };
}

/**
 * Logo URL per brand key, from GET /api/brands. Matched with brandOptions() by brandKey (the
 * server's key is normalized again, so a small difference in the rules never loses a logo).
 * Only http(s) and same-origin /api/images/ URLs pass: never data:, javascript: or others.
 */
export function logosByKey(
  brands: readonly BrandSummary[] | undefined,
): ReadonlyMap<string, string> {
  const logos = new Map<string, string>();
  for (const brand of brands ?? []) {
    const url = brand.logoUrl;
    if (url === null || !isSafeLogoUrl(url)) continue;
    const key = brandKey(brand.key || brand.name);
    if (!logos.has(key)) logos.set(key, url);
  }
  return logos;
}

function isSafeLogoUrl(url: string): boolean {
  return url.startsWith("https://") || url.startsWith("/api/images/");
}
