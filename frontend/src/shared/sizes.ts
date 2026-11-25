import type { ProductSize } from "../api/types";

/**
 * Sizes of the imported cards (api.md §2.2): the one size spelling and sort order of the size
 * filter (features/catalog) and of the product card (shared/ProductCard, CatalogTile).
 */

/** All the ways a «one size» item is written by the sources. */
const ONE_SIZE_WORDS = new Set([
  "onesize",
  "os",
  "universal",
  "універсальний",
  "універсальна",
  "єдиний",
]);
export const ONE_SIZE = "One size";
/** Letter sizes in their natural order (2XL = XXL, 3XL = XXXL). */
const LETTER_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];
const LETTER_ALIASES: Record<string, string> = {
  "2XS": "XXS",
  "2XL": "XXL",
  XXXL: "3XL",
  XXXXL: "4XL",
};
const NUMBER = /^\d+(?:[.,]\d+)?$/;

/**
 * The size as the filter knows it, also its value in ?size=: spaces trimmed and collapsed,
 * letters upper-cased (m → M), 2XL = XXL, every «one size» spelling → «One size». A composite
 * such as «XS/S» stays one size of its own (spaces around «/» removed).
 */
export function sizeKey(label: string): string {
  const text = label
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/");
  if (text === "") return "";
  const compact = text.toLocaleLowerCase("uk").replace(/[\s-]/g, "");
  if (ONE_SIZE_WORDS.has(compact)) return ONE_SIZE;
  const upper = text.toLocaleUpperCase("uk");
  return upper
    .split("/")
    .map((part) => LETTER_ALIASES[part] ?? part)
    .join("/");
}

/** Where a single size goes: letters by LETTER_SIZES, numbers by value; null = neither. */
function partRank(part: string): { group: number; value: number } | null {
  const letter = LETTER_SIZES.indexOf(part);
  if (letter >= 0) return { group: 0, value: letter };
  if (NUMBER.test(part))
    return { group: 1, value: Number(part.replace(",", ".")) };
  return null;
}

/**
 * Sort order: letter sizes (XXS … 4XL), then composites (XS/S, S/M …) by their first part, then
 * numbers ascending (26, 28, 42 …), then anything else by name, and «One size» last.
 */
function sizeRank(key: string): [number, number, string] {
  if (key === ONE_SIZE) return [5, 0, key];
  const single = partRank(key);
  if (single?.group === 0) return [0, single.value, key];
  if (key.includes("/")) {
    const first = partRank(key.split("/")[0] ?? "");
    return [1, first ? first.group * 1000 + first.value : 9999, key];
  }
  if (single?.group === 1) return [2, single.value, key];
  return [3, 0, key];
}

export function compareSizes(a: string, b: string): number {
  const [ga, va, ka] = sizeRank(a);
  const [gb, vb, kb] = sizeRank(b);
  return ga - gb || va - vb || ka.localeCompare(kb, "uk");
}

/** The card's sizes in the filter's order (sizeKey, compareSizes); labels stay as written. */
export function sortSizes(sizes: readonly ProductSize[]): ProductSize[] {
  return [...sizes].sort((a, b) =>
    compareSizes(sizeKey(a.label), sizeKey(b.label)),
  );
}

/** «Мало розмірів»: 1–LOW_STOCK_SIZES sizes left in stock, or none at all. */
export type StockHint = { kind: "few"; count: number } | { kind: "none" };

/**
 * «Мало розмірів»: up to this many sizes in stock (1 or 2). The one threshold of the red count,
 * the «Залишилось N розміри» in the label of the size circles and every other «few» check:
 * they all read stockHint, which is the only place that compares with it.
 */
export const LOW_STOCK_SIZES = 2;

/**
 * The sizes in stock, each once (by sizeKey, the first spelling wins), in the filter's order:
 * the circles on the tile and on the front of the card.
 */
export function sizesInStock(sizes: readonly ProductSize[]): ProductSize[] {
  const seen = new Set<string>();
  return sortSizes(sizes).filter((size) => {
    const key = sizeKey(size.label);
    if (!size.available || key === "" || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * How many sizes are left: null without sizes (brand-made cards) or with 4+ in stock; «few»
 * with 1–LOW_STOCK_SIZES (the red count over the circles); «none» when every size is sold out.
 */
export function stockHint(
  sizes: readonly ProductSize[] | undefined,
): StockHint | null {
  if (sizes === undefined || sizes.length === 0) return null;
  const count = sizesInStock(sizes).length;
  if (count === 0) return { kind: "none" };
  if (count <= LOW_STOCK_SIZES) return { kind: "few", count };
  return null;
}
