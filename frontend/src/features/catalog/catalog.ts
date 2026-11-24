/**
 * Pure logic of the catalogue page: paging by «Показати ще», the price filter and the filter
 * panel state.
 */

import { catalogTexts as t } from "../../shared/messages.uk";
import { formatPrice } from "../../shared/price";

/** Tiles shown at first and added by each «Показати ще». */
export const CATALOG_PAGE_SIZE = 24;

/** How many tiles are shown after one more «Показати ще» (never more than there are). */
export function nextVisibleCount(visible: number, total: number): number {
  return Math.min(visible + CATALOG_PAGE_SIZE, total);
}

/** True while some products are still hidden behind «Показати ще». */
export function hasMore(visible: number, total: number): boolean {
  return visible < total;
}

/* ---------- Price filter (client side over GET /api/feed: all published cards at once) ---------- */

/** Range of the «Ціна» filter, in whole hryvnias. PRICE_MAX on the right means «no limit». */
export const PRICE_MIN = 0;
export const PRICE_MAX = 10_000;
export const PRICE_STEP = 100;
/** PageUp / PageDown on a slider thumb. */
export const PRICE_PAGE_STEP = 1_000;

/** Search parameters of the home page (/) that hold the applied price range. */
export const MIN_PRICE_PARAM = "minPrice";
export const MAX_PRICE_PARAM = "maxPrice";

/** Applied range: null on a side means no limit there (PRICE_MIN / PRICE_MAX). */
export interface PriceRange {
  min: number | null;
  max: number | null;
}

export const NO_PRICE_RANGE: PriceRange = { min: null, max: null };

export function hasPriceRange(range: PriceRange): boolean {
  return range.min !== null || range.max !== null;
}

/** A whole number in 0…PRICE_MAX from a URL parameter, or null for anything else. */
function parsePriceParam(raw: string | null): number | null {
  if (raw === null || !/^\d+$/.test(raw.trim())) return null;
  const value = Number(raw.trim());
  return value <= PRICE_MAX ? value : null;
}

/**
 * The applied range from the URL. An invalid parameter (not a whole number, negative, above
 * PRICE_MAX) is ignored; minPrice=0 and maxPrice=PRICE_MAX mean «no limit»; min above max
 * ignores both.
 */
export function parsePriceRange(params: URLSearchParams): PriceRange {
  const rawMin = parsePriceParam(params.get(MIN_PRICE_PARAM));
  const rawMax = parsePriceParam(params.get(MAX_PRICE_PARAM));
  const min = rawMin !== null && rawMin > PRICE_MIN ? rawMin : null;
  const max = rawMax !== null && rawMax < PRICE_MAX ? rawMax : null;
  if (min !== null && max !== null && min > max) return NO_PRICE_RANGE;
  return { min, max };
}

/** Cards with min <= priceUah <= max (both inclusive); every card without a range. */
export function filterByPriceRange<T extends { priceUah: number }>(
  items: readonly T[],
  range: PriceRange,
): readonly T[] {
  if (!hasPriceRange(range)) return items;
  const { min, max } = range;
  return items.filter(
    (item) =>
      (min === null || item.priceUah >= min) &&
      (max === null || item.priceUah <= max),
  );
}

/** Slider values (edges included) → applied range (edges become null). */
export function toPriceRange(min: number, max: number): PriceRange {
  return {
    min: min > PRICE_MIN ? min : null,
    max: max < PRICE_MAX ? max : null,
  };
}

/**
 * A copy of the search params with the range: minPrice only when above PRICE_MIN, maxPrice
 * only when below PRICE_MAX; both on the edges = no filter.
 */
export function withPriceRange(
  params: URLSearchParams,
  range: PriceRange,
): URLSearchParams {
  const next = new URLSearchParams(params);
  const { min, max } = toPriceRange(
    range.min ?? PRICE_MIN,
    range.max ?? PRICE_MAX,
  );
  if (min === null) next.delete(MIN_PRICE_PARAM);
  else next.set(MIN_PRICE_PARAM, String(min));
  if (max === null) next.delete(MAX_PRICE_PARAM);
  else next.set(MAX_PRICE_PARAM, String(max));
  return next;
}

/**
 * The apply button («Показати …»): the new URL params and the panel state. The drawer (phone, tablet) closes; the column
 * beside the grid on a laptop stays. The URL keeps the filter, so Back, reload and links work.
 */
export function applyPriceFilter(
  params: URLSearchParams,
  range: PriceRange,
  isDrawer: boolean,
): { params: URLSearchParams; panelOpen: boolean } {
  return { params: withPriceRange(params, range), panelOpen: !isDrawer };
}

/** «500 – 2500 грн», «від 500 грн», «до 2500 грн» (prices as everywhere, shared/price.ts). */
export function formatPriceRange(range: PriceRange): string {
  if (range.min !== null && range.max !== null) {
    return t.priceBetween(String(range.min), formatPrice(range.max));
  }
  if (range.min !== null) return t.priceFrom(formatPrice(range.min));
  if (range.max !== null) return t.priceTo(formatPrice(range.max));
  return "";
}

/**
 * A price in the filter fields and the apply button: thousands split by a no-break space
 * («10 000», never broken across lines). Cards and chips keep «2400 грн» (shared/price.ts).
 */
export function formatThousands(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
}

/**
 * Text of the apply button under the slider, for the range it would apply:
 * «Показати від 500 до 2 500 грн», «Показати до 2 500 грн», «Показати від 500 грн»,
 * «Показати всі ціни».
 */
export function priceApplyLabel(range: PriceRange): string {
  const { min, max } = range;
  if (min !== null && max !== null) {
    return t.priceShowBetween(formatThousands(min), formatThousands(max));
  }
  if (min !== null) return t.priceShowFrom(formatThousands(min));
  if (max !== null) return t.priceShowTo(formatThousands(max));
  return t.priceShowAll;
}

export function samePriceRange(a: PriceRange, b: PriceRange): boolean {
  return a.min === b.min && a.max === b.max;
}

/** A slider value as the buyer reads it: «2500 грн», and «10000+ грн» for «no limit». */
export function formatPriceLimit(value: number): string {
  return value >= PRICE_MAX ? t.priceOrMore(PRICE_MAX) : formatPrice(value);
}

/* ---------- The range being edited in the panel (fields + two-thumb slider) ---------- */

export type PriceThumb = "min" | "max";

/**
 * Values of the two thumbs and the text in the two fields. The text changes while typing; the
 * value follows on blur / Enter («commit»), so a half-typed number never moves a thumb.
 */
export interface PriceDraft {
  min: number;
  max: number;
  minText: string;
  maxText: string;
}

export type PriceDraftAction =
  | { type: "slide"; thumb: PriceThumb; value: number }
  | { type: "type"; thumb: PriceThumb; text: string }
  | { type: "commit"; thumb: PriceThumb };

/** Opens on the applied range; without a filter, the thumbs are on the edges. */
export function initialPriceDraft(range: PriceRange): PriceDraft {
  const min = range.min ?? PRICE_MIN;
  const max = range.max ?? PRICE_MAX;
  return {
    min,
    max,
    minText: formatThousands(min),
    maxText: formatThousands(max),
  };
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/**
 * Moves one thumb, kept inside the range and at least one step from the other thumb, so the
 * thumbs never cross. The field of that thumb shows the new value.
 */
export function setThumb(
  draft: PriceDraft,
  thumb: PriceThumb,
  value: number,
): PriceDraft {
  const whole = Number.isFinite(value) ? Math.round(value) : PRICE_MIN;
  if (thumb === "min") {
    const min = clamp(whole, PRICE_MIN, draft.max - PRICE_STEP);
    return { ...draft, min, minText: formatThousands(min) };
  }
  const max = clamp(whole, draft.min + PRICE_STEP, PRICE_MAX);
  return { ...draft, max, maxText: formatThousands(max) };
}

/**
 * A typed field as a number: spaces are ignored; anything that is not a number goes to the
 * field's own edge (0 for «від», 10000 for «до»); the range clamp in setThumb does the rest.
 */
export function parsePriceField(text: string, thumb: PriceThumb): number {
  const cleaned = text.replace(/\s/g, "");
  const value = cleaned === "" ? Number.NaN : Number(cleaned);
  if (Number.isNaN(value)) return thumb === "min" ? PRICE_MIN : PRICE_MAX;
  return value;
}

export function priceDraftReducer(
  draft: PriceDraft,
  action: PriceDraftAction,
): PriceDraft {
  switch (action.type) {
    case "slide":
      return setThumb(draft, action.thumb, action.value);
    case "type": {
      // The field takes digits only; it is formatted («10 000») again on commit.
      const text = action.text.replace(/\D/g, "");
      return action.thumb === "min"
        ? { ...draft, minText: text }
        : { ...draft, maxText: text };
    }
    case "commit": {
      const text = action.thumb === "min" ? draft.minText : draft.maxText;
      return setThumb(draft, action.thumb, parsePriceField(text, action.thumb));
    }
  }
}

/** The apply button: the range with both fields committed (a field still being typed in counts too). */
export function committedRange(draft: PriceDraft): PriceRange {
  const withMin = priceDraftReducer(draft, { type: "commit", thumb: "min" });
  const both = priceDraftReducer(withMin, { type: "commit", thumb: "max" });
  return toPriceRange(both.min, both.max);
}

/**
 * The value a key gives a thumb: arrows ±PRICE_STEP, PageUp/PageDown ±PRICE_PAGE_STEP,
 * Home/End the edges; null for other keys. setThumb then keeps the thumbs apart.
 */
export function thumbValueForKey(value: number, key: string): number | null {
  switch (key) {
    case "ArrowLeft":
    case "ArrowDown":
      return value - PRICE_STEP;
    case "ArrowRight":
    case "ArrowUp":
      return value + PRICE_STEP;
    case "PageDown":
      return value - PRICE_PAGE_STEP;
    case "PageUp":
      return value + PRICE_PAGE_STEP;
    case "Home":
      return PRICE_MIN;
    case "End":
      return PRICE_MAX;
    default:
      return null;
  }
}

/** Position of a value on the line, 0…100 %: PRICE_MIN at the very start, PRICE_MAX at the end. */
export function pricePercent(value: number): number {
  return (
    ((clamp(value, PRICE_MIN, PRICE_MAX) - PRICE_MIN) /
      (PRICE_MAX - PRICE_MIN)) *
    100
  );
}

/** A pointer at `x` on a line from `left` of `width` px → a value snapped to PRICE_STEP. */
export function priceAtPointer(x: number, left: number, width: number): number {
  const ratio = width > 0 ? clamp((x - left) / width, 0, 1) : 0;
  const raw = PRICE_MIN + ratio * (PRICE_MAX - PRICE_MIN);
  return clamp(Math.round(raw / PRICE_STEP) * PRICE_STEP, PRICE_MIN, PRICE_MAX);
}

/** The thumb a press on the line moves: the nearer one; past either thumb, that thumb. */
export function nearestThumb(
  thumbs: { min: number; max: number },
  value: number,
): PriceThumb {
  if (value <= thumbs.min) return "min";
  if (value >= thumbs.max) return "max";
  return value - thumbs.min <= thumbs.max - value ? "min" : "max";
}

/* ---------- Brand filter (client side: brands collected from GET /api/feed) ---------- */

/** Repeated search parameter of the home page: ?brand=<key>&brand=<key2>. */
export const BRAND_PARAM = "brand";
/** Brands shown before «Показати всі (N)». */
export const BRAND_LIST_LIMIT = 8;
/** With more brands than this, a «Пошук бренду» field sits over the list. */
export const BRAND_SEARCH_MIN = 12;

/** Brand key: case and extra spaces ignored, so «CHER'17» and « Cher'17 » are one brand. */
export function brandKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Link to the clothes of one brand: exactly /?brand=<key>, no other filters. */
export function brandHref(name: string): string {
  return `/?${new URLSearchParams({ [BRAND_PARAM]: brandKey(name) }).toString()}`;
}

export interface BrandOption {
  /** brandKey(name): the value in the URL. */
  key: string;
  /** The most frequent spelling in the catalogue. */
  label: string;
  /** Products of the brand in the whole catalogue. */
  count: number;
}

/**
 * Unique brands of the catalogue with their product counts, sorted by name (Ukrainian
 * alphabet). Spellings that differ only in case or spaces are one brand, labelled by the most
 * frequent spelling (the first one seen on a tie).
 */
export function brandOptions(
  items: readonly { brandName: string }[],
): BrandOption[] {
  const brands = new Map<
    string,
    { count: number; spellings: Map<string, number> }
  >();
  for (const item of items) {
    const key = brandKey(item.brandName);
    if (key === "") continue;
    const brand = brands.get(key) ?? { count: 0, spellings: new Map() };
    const spelling = item.brandName.trim().replace(/\s+/g, " ");
    brand.count += 1;
    brand.spellings.set(spelling, (brand.spellings.get(spelling) ?? 0) + 1);
    brands.set(key, brand);
  }
  const options: BrandOption[] = [];
  for (const [key, brand] of brands) {
    let label = "";
    let best = 0;
    for (const [spelling, count] of brand.spellings) {
      if (count > best) {
        label = spelling;
        best = count;
      }
    }
    options.push({ key, label, count: brand.count });
  }
  return options.sort((a, b) => a.label.localeCompare(b.label, "uk"));
}

/**
 * The brands the «Бренд» group shows, in catalogue order:
 * - a search query: every brand whose name contains it (case and spaces ignored);
 * - expanded («Показати всі»): every brand;
 * - collapsed: the first BRAND_LIST_LIMIT plus every chosen brand, so a choice is never
 *   hidden after «Згорнути».
 */
export function visibleBrands(
  options: readonly BrandOption[],
  selected: readonly string[],
  view: { expanded: boolean; query: string },
): readonly BrandOption[] {
  const query = brandKey(view.query);
  if (query !== "") {
    return options.filter(
      (option) =>
        option.key.includes(query) || brandKey(option.label).includes(query),
    );
  }
  if (view.expanded) return options;
  const chosen = new Set(selected);
  return options.filter(
    (option, index) => index < BRAND_LIST_LIMIT || chosen.has(option.key),
  );
}

/* ---------- All filters together ---------- */

/** Every filter of the catalogue; null price sides mean no limit, no brands means all. */
export interface CatalogFilters {
  minPrice: number | null;
  maxPrice: number | null;
  /** Brand keys (brandKey), in URL order, without repeats. */
  brands: readonly string[];
}

export const NO_FILTERS: CatalogFilters = {
  minPrice: null,
  maxPrice: null,
  brands: [],
};

export function priceRangeOf(filters: CatalogFilters): PriceRange {
  return { min: filters.minPrice, max: filters.maxPrice };
}

/** Brand keys of the URL: normalized, without repeats and empty values. */
function brandsInUrl(params: URLSearchParams): string[] {
  const keys = params.getAll(BRAND_PARAM).map(brandKey);
  return [...new Set(keys)].filter((key) => key !== "");
}

/**
 * Filters from the URL. Invalid prices are ignored (parsePriceRange). With `knownBrands` (the
 * keys of the loaded catalogue), brands that are not in it are ignored; while the catalogue
 * is loading (null), every brand is kept.
 */
export function parseFilters(
  params: URLSearchParams,
  knownBrands: ReadonlySet<string> | null = null,
): CatalogFilters {
  const price = parsePriceRange(params);
  const brands = brandsInUrl(params).filter(
    (key) => knownBrands === null || knownBrands.has(key),
  );
  return { minPrice: price.min, maxPrice: price.max, brands };
}

/**
 * Cards that pass every filter: the brand is one of the chosen ones (OR between brands) AND
 * the price is in the range (both ends included).
 */
export function filterCatalog<
  T extends { priceUah: number; brandName: string },
>(items: readonly T[], filters: CatalogFilters): readonly T[] {
  const byPrice = filterByPriceRange(items, priceRangeOf(filters));
  if (filters.brands.length === 0) return byPrice;
  const brands = new Set(filters.brands);
  return byPrice.filter((item) => brands.has(brandKey(item.brandName)));
}

/**
 * «Сторінка бренду»: exactly one brand and no other filter. Pass the filters parsed WITHOUT
 * known brands, so a brand that is not in the catalogue still shows its empty brand page.
 */
export function isSingleBrandView(filters: CatalogFilters): boolean {
  return (
    filters.brands.length === 1 &&
    filters.minPrice === null &&
    filters.maxPrice === null
  );
}

/** Badge on «Фільтри»: each brand counts, the price range counts once. */
export function countActiveFilters(filters: CatalogFilters): number {
  return filters.brands.length + (hasPriceRange(priceRangeOf(filters)) ? 1 : 0);
}

/** Changes whenever any filter does (first page again, scroll, announcement). */
export function filtersKey(filters: CatalogFilters): string {
  return `${filters.minPrice}-${filters.maxPrice}-${filters.brands.join("|")}`;
}

function withBrands(params: URLSearchParams, brands: readonly string[]) {
  const next = new URLSearchParams(params);
  next.delete(BRAND_PARAM);
  for (const key of brands) next.append(BRAND_PARAM, key);
  return next;
}

/** A click on a brand: adds it to ?brand=, or removes it when it is already there. */
export function withBrandToggled(
  params: URLSearchParams,
  key: string,
): URLSearchParams {
  const brand = brandKey(key);
  const brands = brandsInUrl(params);
  return withBrands(
    params,
    brands.includes(brand)
      ? brands.filter((item) => item !== brand)
      : [...brands, brand],
  );
}

/** «Скинути все»: no price range, no brands; other parameters stay. */
export function withoutFilters(params: URLSearchParams): URLSearchParams {
  return withBrands(withPriceRange(params, NO_PRICE_RANGE), []);
}

/** One chip above the grid; `id` is "price" or "brand:<key>". */
export interface FilterChip {
  id: string;
  label: string;
  /** aria-label of the chip: what its ✕ resets. */
  removeLabel: string;
}

/** Chips of the active filters: one per chosen brand (catalogue order of choice), then price. */
export function filterChips(
  filters: CatalogFilters,
  options: readonly BrandOption[],
): FilterChip[] {
  const labels = new Map(options.map((option) => [option.key, option.label]));
  const chips: FilterChip[] = filters.brands.map((key) => {
    const label = labels.get(key) ?? key;
    return { id: `brand:${key}`, label, removeLabel: t.brandChipLabel(label) };
  });
  const price = priceRangeOf(filters);
  if (hasPriceRange(price)) {
    const range = formatPriceRange(price);
    chips.push({
      id: "price",
      label: t.priceChip(range),
      removeLabel: t.priceChipLabel(range),
    });
  }
  return chips;
}

/** The ✕ of one chip: removes only that filter. */
export function withoutFilter(
  params: URLSearchParams,
  chipId: string,
): URLSearchParams {
  if (chipId === "price") return withPriceRange(params, NO_PRICE_RANGE);
  if (!chipId.startsWith("brand:")) return new URLSearchParams(params);
  const key = chipId.slice("brand:".length);
  return withBrands(
    params,
    brandsInUrl(params).filter((item) => item !== key),
  );
}

export type FilterPanelAction =
  | { type: "toggle" }
  | { type: "close" }
  /** A key pressed while the panel is open: only Escape closes it. */
  | { type: "key"; key: string };

/** Open/closed state of the filter panel: «Фільтри» toggles; ✕, Escape and the backdrop close. */
export function filterPanelReducer(
  open: boolean,
  action: FilterPanelAction,
): boolean {
  switch (action.type) {
    case "toggle":
      return !open;
    case "close":
      return false;
    case "key":
      return action.key === "Escape" ? false : open;
  }
}
