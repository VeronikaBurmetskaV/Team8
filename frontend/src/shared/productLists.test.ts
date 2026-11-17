import { describe, expect, it, vi } from "vitest";
import {
  addSwipeLike,
  addToFavorites,
  createFavoriteLists,
  createProductList,
  FAVORITES_STORAGE_KEY,
  SWIPE_FAVORITES_STORAGE_KEY,
  type SavedProduct,
} from "./productLists";
import { productsCount } from "./messages.uk";
import { brokenStorage, memoryStorage } from "./testStorage";

function product(id: string): SavedProduct {
  return {
    id,
    name: `Сукня ${id}`,
    brandName: "Бренд",
    priceUah: 2400,
    photoUrl: `https://img.example/${id}.jpg`,
    productUrl: `https://brand.example/${id}`,
  };
}

function setup() {
  const storage = memoryStorage();
  return { storage, lists: createFavoriteLists(() => storage) };
}

const ids = (items: readonly SavedProduct[]) => items.map((item) => item.id);

describe("swipe like (feed → «Вподобане зі свайпів»)", () => {
  it("adds only to «Вподобане зі свайпів», not to «Вподобане»", () => {
    const { storage, lists } = setup();
    addSwipeLike(product("a"), lists);
    expect(ids(lists.swipeFavorites.read())).toEqual(["a"]);
    expect(lists.favorites.read()).toEqual([]);
    expect(storage.getItem(FAVORITES_STORAGE_KEY)).toBeNull();
  });

  it("does not duplicate the same product", () => {
    const { lists } = setup();
    addSwipeLike(product("a"), lists);
    addSwipeLike(product("b"), lists);
    const result = addSwipeLike(product("a"), lists);
    expect(ids(result)).toEqual(["a", "b"]);
    expect(ids(lists.swipeFavorites.read())).toEqual(["a", "b"]);
  });

  it("stores only the card fields, not the whole feed card", () => {
    const { lists } = setup();
    addSwipeLike({ ...product("a"), material: "льон" } as SavedProduct, lists);
    expect(lists.swipeFavorites.read()[0]).toEqual(product("a"));
  });
});

describe("«Додати у Вподобане»", () => {
  it("adds to the general list and keeps the swipe list as it was", () => {
    const { lists } = setup();
    addSwipeLike(product("a"), lists);
    addToFavorites(product("a"), lists);
    expect(ids(lists.favorites.read())).toEqual(["a"]);
    expect(lists.favorites.has("a")).toBe(true);
    expect(ids(lists.swipeFavorites.read())).toEqual(["a"]);
  });

  it("does not duplicate in «Вподобане»", () => {
    const { lists } = setup();
    addToFavorites(product("a"), lists);
    addToFavorites(product("a"), lists);
    expect(lists.favorites.read()).toHaveLength(1);
  });
});

describe("«Прибрати»", () => {
  it("removes from «Вподобане зі свайпів» only", () => {
    const { lists } = setup();
    addSwipeLike(product("a"), lists);
    addSwipeLike(product("b"), lists);
    addToFavorites(product("a"), lists);
    expect(ids(lists.swipeFavorites.remove("a"))).toEqual(["b"]);
    expect(ids(lists.favorites.read())).toEqual(["a"]);
  });

  it("removes from «Вподобане» only", () => {
    const { lists } = setup();
    addSwipeLike(product("a"), lists);
    addToFavorites(product("a"), lists);
    expect(lists.favorites.remove("a")).toEqual([]);
    expect(lists.favorites.has("a")).toBe(false);
    expect(ids(lists.swipeFavorites.read())).toEqual(["a"]);
  });
});

describe("persistence", () => {
  it("keeps both lists after a reload (a new store over the same storage)", () => {
    const { storage, lists } = setup();
    addSwipeLike(product("a"), lists);
    addSwipeLike(product("b"), lists);
    addToFavorites(product("b"), lists);

    const reloaded = createFavoriteLists(() => storage);
    expect(ids(reloaded.swipeFavorites.read())).toEqual(["a", "b"]);
    expect(ids(reloaded.favorites.read())).toEqual(["b"]);
  });

  it("writes each list under its own key with a version", () => {
    const { storage, lists } = setup();
    addSwipeLike(product("a"), lists);
    addToFavorites(product("b"), lists);
    expect(
      JSON.parse(storage.getItem(SWIPE_FAVORITES_STORAGE_KEY) ?? "null"),
    ).toEqual({ version: 1, items: [product("a")] });
    expect(
      JSON.parse(storage.getItem(FAVORITES_STORAGE_KEY) ?? "null"),
    ).toEqual({ version: 1, items: [product("b")] });
  });

  it("reads broken JSON, another version or malformed items as empty", () => {
    const { storage, lists } = setup();
    storage.setItem(FAVORITES_STORAGE_KEY, "{not json");
    expect(lists.favorites.read()).toEqual([]);
    storage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify({ version: 2, items: [product("a")] }),
    );
    expect(lists.favorites.read()).toEqual([]);
    storage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify({ version: 1, items: [product("a"), { id: 5 }] }),
    );
    expect(ids(lists.favorites.read())).toEqual(["a"]);
  });

  it("returns the same array until the data changes (stable snapshot)", () => {
    const { lists } = setup();
    addSwipeLike(product("a"), lists);
    const first = lists.swipeFavorites.read();
    expect(lists.swipeFavorites.read()).toBe(first);
    addSwipeLike(product("b"), lists);
    expect(lists.swipeFavorites.read()).not.toBe(first);
  });

  it("sees a change written by another tab", () => {
    const { storage, lists } = setup();
    const otherTab = createFavoriteLists(() => storage);
    otherTab.favorites.add(product("a"));
    expect(ids(lists.favorites.read())).toEqual(["a"]);
  });

  it("keeps working for this page view when storage is blocked", () => {
    const storage = brokenStorage();
    const list = createProductList(FAVORITES_STORAGE_KEY, () => storage);
    expect(() => list.add(product("a"))).not.toThrow();
    expect(ids(list.read())).toEqual(["a"]);
    expect(list.remove("a")).toEqual([]);
  });
});

describe("subscribe", () => {
  it("notifies listeners on add and remove, not on a no-op", () => {
    const { lists } = setup();
    const listener = vi.fn();
    const unsubscribe = lists.favorites.subscribe(listener);
    lists.favorites.add(product("a"));
    lists.favorites.add(product("a"));
    lists.favorites.remove("zzz");
    lists.favorites.remove("a");
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    lists.favorites.add(product("b"));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe("productsCount", () => {
  it.each([
    [1, "1 товар"],
    [3, "3 товари"],
    [5, "5 товарів"],
    [11, "11 товарів"],
    [12, "12 товарів"],
    [21, "21 товар"],
    [22, "22 товари"],
  ])("%i → %s", (count, text) => {
    expect(productsCount(count)).toBe(text);
  });
});
