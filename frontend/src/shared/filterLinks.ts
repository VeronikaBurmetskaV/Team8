/**
 * The catalogue filters live in the URL (features/catalog): ?minPrice=&maxPrice=&brand=…
 * The home page (/) and the swipe feed (/feed) share them, so every link between the two
 * carries the current filter parameters along. Shared code (the header) only copies the
 * parameters; parsing and checking them is features/catalog's job.
 */
export const MIN_PRICE_PARAM = "minPrice";
export const MAX_PRICE_PARAM = "maxPrice";
export const BRAND_PARAM = "brand";
/** Repeated: ?size=M&size=XS%2FS (catalog.ts sizeKey). */
export const SIZE_PARAM = "size";
export const FILTER_PARAMS: readonly string[] = [
  MIN_PRICE_PARAM,
  MAX_PRICE_PARAM,
  BRAND_PARAM,
  SIZE_PARAM,
];

/** Only the filter parameters of a query string, in their order (other parameters dropped). */
export function filterParamsOf(
  search: string | URLSearchParams,
): URLSearchParams {
  const params = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const [name, value] of params) {
    if (FILTER_PARAMS.includes(name)) kept.append(name, value);
  }
  return kept;
}

/** `path` with the filter parameters of `search`: «/feed?maxPrice=2500&brand=mint». */
export function withFilterParams(
  path: string,
  search: string | URLSearchParams,
): string {
  const query = filterParamsOf(search).toString();
  return query === "" ? path : `${path}?${query}`;
}
