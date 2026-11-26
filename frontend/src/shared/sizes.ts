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

/**
 * Every size is sold out. (There is no «few sizes left» hint: the number of sizes in stock says
 * nothing about how many items are left, so it is never shown as a stock warning.)
 */
export type StockHint = { kind: "none" };

/**
 * Every size once (by sizeKey), in the filter's order: the circles on the front of the card,
 * sold-out ones included. A size is in stock when any of its spellings is; it keeps the first
 * spelling in stock, else the first one. Empty labels are dropped.
 */
export function uniqueSizes(sizes: readonly ProductSize[]): ProductSize[] {
  const result: ProductSize[] = [];
  const indexByKey = new Map<string, number>();
  for (const size of sortSizes(sizes)) {
    const key = sizeKey(size.label);
    if (key === "") continue;
    const index = indexByKey.get(key);
    const merged = index === undefined ? undefined : result[index];
    if (index === undefined || merged === undefined) {
      indexByKey.set(key, result.length);
      result.push(
        size.quantity === undefined
          ? { label: size.label, available: isInStock(size) }
          : {
              label: size.label,
              available: isInStock(size),
              quantity: size.quantity,
            },
      );
    } else {
      // The same size written twice (e.g. two colours): in stock when any copy is; its count is
      // unknown, because counts of two copies are never added up or picked.
      const available = merged.available || isInStock(size);
      result[index] = {
        label: merged.available || !isInStock(size) ? merged.label : size.label,
        available,
      };
    }
  }
  return result;
}

/** In stock: available, and not stated to have 0 items left. */
function isInStock(size: ProductSize): boolean {
  return size.available && size.quantity !== 0;
}

/**
 * The sizes in stock, each once (by sizeKey, the first spelling in stock wins), in the filter's
 * order: the circles on the tile.
 */
export function sizesInStock(sizes: readonly ProductSize[]): ProductSize[] {
  return uniqueSizes(sizes).filter((size) => size.available);
}

/**
 * A size gets the red badge with its number of items left when that number is known and from 1
 * to LOW_STOCK_QUANTITY. Not final: a product decision, kept in this one place.
 */
export const LOW_STOCK_QUANTITY = 4;

/**
 * The number on the size's red badge, or null for no badge: only a size in stock whose exact
 * count (from the source, api.md §2.2) is 1…LOW_STOCK_QUANTITY. Unknown counts, 5 or more, and
 * sold-out sizes (grey and struck through instead) get no badge.
 */
export function lowStockQuantity(size: ProductSize): number | null {
  const { quantity } = size;
  if (!isInStock(size) || quantity === undefined) return null;
  if (!Number.isInteger(quantity)) return null;
  return quantity >= 1 && quantity <= LOW_STOCK_QUANTITY ? quantity : null;
}

/**
 * «none» when the card has sizes and every one is sold out (the small grey «Немає в наявності»
 * instead of the circles); null otherwise, also without sizes (brand-made cards).
 */
export function stockHint(
  sizes: readonly ProductSize[] | undefined,
): StockHint | null {
  if (sizes === undefined || sizes.length === 0) return null;
  return sizesInStock(sizes).length === 0 ? { kind: "none" } : null;
}
