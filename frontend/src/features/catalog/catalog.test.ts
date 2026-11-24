import { describe, expect, it } from "vitest";
import {
  CATALOG_PAGE_SIZE,
  filterPanelReducer,
  hasMore,
  nextVisibleCount,
} from "./catalog";
import {
  addToFavorites,
  createFavoriteList,
  FAVORITES_STORAGE_KEY,
  toggleFavorite,
  type SavedProduct,
} from "../../shared/productLists";
import { memoryStorage } from "../../shared/testStorage";

describe("«Показати ще»", () => {
  it("shows 24 first, then 24 more, then the rest, then nothing more", () => {
    const total = 60;
    let visible = Math.min(CATALOG_PAGE_SIZE, total);
    expect(visible).toBe(24);
    expect(hasMore(visible, total)).toBe(true);

    visible = nextVisibleCount(visible, total);
    expect(visible).toBe(48);
    expect(hasMore(visible, total)).toBe(true);

    visible = nextVisibleCount(visible, total);
    expect(visible).toBe(60);
    expect(hasMore(visible, total)).toBe(false);

    expect(nextVisibleCount(visible, total)).toBe(60);
  });

  it("has nothing more when the catalogue fits on the first page", () => {
    expect(hasMore(10, 10)).toBe(false);
    expect(hasMore(24, 24)).toBe(false);
    expect(hasMore(0, 0)).toBe(false);
  });
});

describe("filter panel", () => {
  it("«Фільтри» opens and closes it", () => {
    const opened = filterPanelReducer(false, { type: "toggle" });
    expect(opened).toBe(true);
    expect(filterPanelReducer(opened, { type: "toggle" })).toBe(false);
  });

  it("the ✕ button and a click on the backdrop close it", () => {
    expect(filterPanelReducer(true, { type: "close" })).toBe(false);
    expect(filterPanelReducer(false, { type: "close" })).toBe(false);
  });

  it("Escape closes it, other keys do not", () => {
    expect(filterPanelReducer(true, { type: "key", key: "Escape" })).toBe(
      false,
    );
    expect(filterPanelReducer(true, { type: "key", key: "Tab" })).toBe(true);
    expect(filterPanelReducer(true, { type: "key", key: "Enter" })).toBe(true);
  });
});

describe("heart on a tile", () => {
  const product: SavedProduct = {
    id: "p1",
    name: "Лляна сукня",
    brandName: "Бренд",
    priceUah: 2400,
    photoUrl: "https://img.example/p1.jpg",
    productUrl: "https://brand.example/p1",
  };

  it("adds to the one «Вподобане»", () => {
    const storage = memoryStorage();
    const list = createFavoriteList(() => storage);

    expect(toggleFavorite(product, list)).toBe(true);
    expect(list.has("p1")).toBe(true);
    expect(storage.getItem(FAVORITES_STORAGE_KEY)).toContain('"p1"');
  });

  it("a product already liked in the swipe feed is not added twice", () => {
    const storage = memoryStorage();
    const list = createFavoriteList(() => storage);
    addToFavorites(product, list); // swipe right in /feed
    // The tile shows a filled heart, so this click removes rather than duplicates.
    expect(toggleFavorite(product, list)).toBe(false);
    toggleFavorite(product, list);
    addToFavorites(product, list);
    expect(list.read()).toHaveLength(1);
  });

  it("a second click removes it again", () => {
    const storage = memoryStorage();
    const list = createFavoriteList(() => storage);
    toggleFavorite(product, list);

    expect(toggleFavorite(product, list)).toBe(false);
    expect(list.has("p1")).toBe(false);
  });
});
