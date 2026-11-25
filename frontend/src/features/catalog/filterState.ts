/**
 * Filters shared by the catalogue (/) and the swipe feed (/feed): the URL is the source of
 * truth (?minPrice=&maxPrice=&brand=…); the last applied filters are also remembered in
 * localStorage, only to OFFER them back («Повернути фільтри: …») — never applied by themselves.
 */
import { catalogTexts as t } from "../../shared/messages.uk";
import {
  safeGet,
  safeRemove,
  safeSet,
  type KeyValueStorage,
} from "../../shared/storage";
import {
  BRAND_PARAM,
  SIZE_PARAM,
  countActiveFilters,
  filterChips,
  filtersKey,
  MAX_PRICE_PARAM,
  MIN_PRICE_PARAM,
  NO_FILTERS,
  parseFilters,
  type BrandOption,
  type CatalogFilters,
} from "./catalog";

/** One versioned key; the value is the filters' query string («maxPrice=2500&brand=mint»). */
export const SAVED_FILTERS_KEY = "fulla.filters.v1";

/** The query string of the filters, in a fixed order: prices, then brands, then sizes. */
export function filterParams(filters: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.minPrice !== null) {
    params.set(MIN_PRICE_PARAM, String(filters.minPrice));
  }
  if (filters.maxPrice !== null) {
    params.set(MAX_PRICE_PARAM, String(filters.maxPrice));
  }
  for (const key of filters.brands) params.append(BRAND_PARAM, key);
  for (const key of filters.sizes) params.append(SIZE_PARAM, key);
  return params;
}

/** `path` with the filters: «/feed?maxPrice=2500&brand=mint»; just `path` without filters. */
export function withFilters(path: string, filters: CatalogFilters): string {
  const query = filterParams(filters).toString();
  return query === "" ? path : `${path}?${query}`;
}

/** `params` with its filters replaced by `filters`; other parameters stay. */
export function withFiltersApplied(
  params: URLSearchParams,
  filters: CatalogFilters,
): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const name of [
    MIN_PRICE_PARAM,
    MAX_PRICE_PARAM,
    BRAND_PARAM,
    SIZE_PARAM,
  ]) {
    next.delete(name);
  }
  for (const [name, value] of filterParams(filters)) next.append(name, value);
  return next;
}

/** Remembers the applied filters; no filters → forgets them. */
export function saveFilters(
  storage: KeyValueStorage | undefined,
  filters: CatalogFilters,
): void {
  if (countActiveFilters(filters) === 0) {
    clearSavedFilters(storage);
    return;
  }
  safeSet(storage, SAVED_FILTERS_KEY, filterParams(filters).toString());
}

/** The remembered filters, checked like URL ones; null when none (or nothing valid) is stored. */
export function readSavedFilters(
  storage: KeyValueStorage | undefined,
): CatalogFilters | null {
  const raw = safeGet(storage, SAVED_FILTERS_KEY);
  if (raw === null) return null;
  const filters = parseFilters(new URLSearchParams(raw));
  return countActiveFilters(filters) === 0 ? null : filters;
}

export function clearSavedFilters(storage: KeyValueStorage | undefined): void {
  safeRemove(storage, SAVED_FILTERS_KEY);
}

/**
 * The saved filters to offer, or null: only on a page without filters in the URL, and only
 * when something is saved.
 */
export function filtersToRestore(
  current: CatalogFilters,
  saved: CatalogFilters | null,
): CatalogFilters | null {
  if (saved === null || countActiveFilters(current) > 0) return null;
  return filtersKey(saved) === filtersKey(NO_FILTERS) ? null : saved;
}

/** «Повернути фільтри: MINT, Ціна: до 2500 грн» — the same labels as the chips. */
export function restoreLabel(
  filters: CatalogFilters,
  options: readonly BrandOption[],
): string {
  const labels = filterChips(filters, options).map((chip) => chip.label);
  return t.restoreFilters(labels.join(", "));
}

/**
 * After the buyer changes the filters to `next`: reaching «no filters» by their own action
 * (✕ of the last chip, «Скинути все», «Скинути фільтри») forgets the saved ones too. Returns
 * whether they were forgotten. Opening a page without filters never calls this.
 */
export function forgetIfCleared(
  storage: KeyValueStorage | undefined,
  next: URLSearchParams,
): boolean {
  if (countActiveFilters(parseFilters(next)) > 0) return false;
  clearSavedFilters(storage);
  return true;
}
