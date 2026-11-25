import { describe, expect, it } from "vitest";
import { brokenStorage, memoryStorage } from "../../shared/testStorage";
import { brandOptions, NO_FILTERS, type CatalogFilters } from "./catalog";
import {
  filtersToRestore,
  forgetIfCleared,
  readSavedFilters,
  restoreLabel,
  SAVED_FILTERS_KEY,
  saveFilters,
  withFilters,
  withFiltersApplied,
} from "./filterState";

const filters: CatalogFilters = {
  minPrice: null,
  maxPrice: 2500,
  brands: ["mint", "cher'17"],
  sizes: [],
};

describe("withFilters", () => {
  it("builds the address of a page with the filters", () => {
    expect(withFilters("/feed", filters)).toBe(
      "/feed?maxPrice=2500&brand=mint&brand=cher%2717",
    );
    expect(withFilters("/", NO_FILTERS)).toBe("/");
  });

  it("replaces only the filter parameters of a query", () => {
    const params = new URLSearchParams("brand=gunia&maxPrice=900&tab=x");
    expect(withFiltersApplied(params, filters).toString()).toBe(
      "tab=x&maxPrice=2500&brand=mint&brand=cher%2717",
    );
  });
});

describe("remembered filters", () => {
  it("saves the applied filters and reads them back", () => {
    const storage = memoryStorage();
    saveFilters(storage, filters);
    expect(storage.getItem(SAVED_FILTERS_KEY)).toBe(
      "maxPrice=2500&brand=mint&brand=cher%2717",
    );
    expect(readSavedFilters(storage)).toEqual(filters);
  });

  it("offers them only on a page opened without filters", () => {
    expect(filtersToRestore(NO_FILTERS, filters)).toEqual(filters);
    expect(
      filtersToRestore({ ...NO_FILTERS, minPrice: 100 }, filters),
    ).toBeNull();
    expect(filtersToRestore(NO_FILTERS, null)).toBeNull();
  });

  it("labels the offer like the chips", () => {
    const options = brandOptions([
      { brandName: "Mint" },
      { brandName: "CHER'17" },
    ]);
    expect(restoreLabel(filters, options)).toBe(
      "Повернути фільтри: Mint, CHER'17, Ціна: до 2500 грн",
    );
  });

  it("«Скинути все» (no filters left) forgets them; other changes do not", () => {
    const storage = memoryStorage();
    saveFilters(storage, filters);
    expect(forgetIfCleared(storage, new URLSearchParams("brand=mint"))).toBe(
      false,
    );
    expect(readSavedFilters(storage)).toEqual(filters);
    expect(forgetIfCleared(storage, new URLSearchParams(""))).toBe(true);
    expect(readSavedFilters(storage)).toBeNull();
  });

  it("ignores broken or empty values and a blocked storage", () => {
    const storage = memoryStorage();
    storage.setItem(SAVED_FILTERS_KEY, "maxPrice=-5&foo=bar");
    expect(readSavedFilters(storage)).toBeNull();
    expect(readSavedFilters(brokenStorage())).toBeNull();
    expect(() => saveFilters(brokenStorage(), filters)).not.toThrow();
  });
});
