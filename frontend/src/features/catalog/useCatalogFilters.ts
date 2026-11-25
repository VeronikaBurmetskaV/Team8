import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { browserStorage } from "../../shared/storage";
import {
  applyPriceFilter,
  countActiveFilters,
  filtersKey,
  isSingleBrandView,
  NO_PRICE_RANGE,
  parseFilters,
  withBrandToggled,
  withSizeToggled,
  withoutFilter,
  withoutFilters,
  withPriceRange,
  type CatalogFilters,
  type PriceRange,
} from "./catalog";
import {
  filtersToRestore,
  forgetIfCleared,
  readSavedFilters,
  saveFilters,
  withFiltersApplied,
} from "./filterState";

interface Options {
  /** Brand keys of the loaded catalogue (unknown ?brand= values are ignored); null while loading. */
  knownBrands: ReadonlySet<string> | null;
  /** Size keys of the loaded catalogue (unknown ?size= values are ignored); null while loading. */
  knownSizes?: ReadonlySet<string> | null;
  /** Remember applied filters for «Повернути фільтри» (not on a catalogue brand page). */
  remember: boolean;
  /** After every change made here; `scroll` = the list should start at its top. */
  onChange?: (scroll: boolean) => void;
}

/**
 * The filters of / and /feed, one implementation for both pages. The URL is the source of
 * truth (read with parseFilters, written with URLSearchParams); every change is a new history
 * entry, so «Назад» works. Applied filters are also remembered (shared/storage.ts) and offered
 * back on a page opened without them — never applied by themselves. Resetting forgets them.
 */
export function useCatalogFilters({
  knownBrands,
  knownSizes = null,
  remember,
  onChange,
}: Options) {
  const [searchParams, setSearchParams] = useSearchParams();
  // «Сторінка бренду» (exactly one brand, nothing else) keeps even an unknown brand, so it
  // shows its own empty page; otherwise unknown brands are dropped once the catalogue is known.
  const rawFilters = parseFilters(searchParams);
  const filters: CatalogFilters = isSingleBrandView(rawFilters)
    ? rawFilters
    : parseFilters(searchParams, knownBrands, knownSizes);
  const activeCount = countActiveFilters(filters);
  const filterKey = filtersKey(filters);

  // Applied filters are remembered; the page itself never reads them back on its own.
  useEffect(() => {
    if (remember && activeCount > 0) saveFilters(browserStorage(), filters);
    // The key stands for the filters object, which is new on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remember, filterKey]);

  // Read again whenever the filters change or are forgotten.
  const [forgotten, setForgotten] = useState(0);
  const saved = useMemo(
    () => readSavedFilters(browserStorage()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterKey, forgotten],
  );

  const change = useCallback(
    (next: URLSearchParams, scroll: boolean) => {
      setSearchParams(next);
      // Reaching «no filters» by the buyer's own action forgets the saved ones too.
      if (remember && forgetIfCleared(browserStorage(), next)) {
        setForgotten((count) => count + 1);
      }
      onChange?.(scroll);
    },
    [setSearchParams, remember, onChange],
  );

  /** A brand click applies at once; the panel stays open for more. */
  const toggleBrand = useCallback(
    (key: string) => change(withBrandToggled(searchParams, key), true),
    [searchParams, change],
  );

  /** A size click applies at once, like a brand; the panel stays open for more. */
  const toggleSize = useCallback(
    (key: string) => change(withSizeToggled(searchParams, key), true),
    [searchParams, change],
  );

  /** «Показати …» of the price group; returns whether the panel stays open. */
  const applyPrice = useCallback(
    (range: PriceRange, isDrawer: boolean): boolean => {
      const next = applyPriceFilter(searchParams, range, isDrawer);
      change(next.params, true);
      return next.panelOpen;
    },
    [searchParams, change],
  );

  const resetPrice = useCallback(
    () => change(withPriceRange(searchParams, NO_PRICE_RANGE), false),
    [searchParams, change],
  );

  const removeChip = useCallback(
    (chipId: string) => change(withoutFilter(searchParams, chipId), false),
    [searchParams, change],
  );

  const resetAll = useCallback(
    () => change(withoutFilters(searchParams), false),
    [searchParams, change],
  );

  const toRestore = remember ? filtersToRestore(filters, saved) : null;
  /** «Повернути фільтри: …»: applies the remembered filters with one click. */
  const restore = useCallback(() => {
    if (toRestore !== null)
      change(withFiltersApplied(searchParams, toRestore), true);
  }, [toRestore, searchParams, change]);

  return {
    searchParams,
    rawFilters,
    filters,
    activeCount,
    filterKey,
    toRestore,
    toggleBrand,
    toggleSize,
    applyPrice,
    resetPrice,
    removeChip,
    resetAll,
    restore,
  };
}
