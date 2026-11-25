import { describe, expect, it, vi } from "vitest";
import {
  addToFavorites,
  createFavoriteList,
  createProductList,
  FAVORITES_STORAGE_KEY,
  LEGACY_SWIPE_FAVORITES_STORAGE_KEY,
  migrateSwipeFavorites,
  toggleFavorite,
  type SavedProduct,
} from "./productLists";
import { productsCount } from "./messages.uk";
import { brokenStorage, memoryStorage } from "./testStorage";
import type { KeyValueStorage } from "./storage";

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
  return { storage, list: createFavoriteList(() => storage) };
}

const ids = (items: readonly SavedProduct[]) => items.map((item) => item.id);

function storeLegacy(storage: KeyValueStorage, items: SavedProduct[]) {
  storage.setItem(
    LEGACY_SWIPE_FAVORITES_STORAGE_KEY,
    JSON.stringify({ version: 1, items }),
  );
}

describe("one «Вподобане» for the feed and the catalogue", () => {
  it("a swipe like and the catalogue heart land in the same list, once", () => {
    const { storage, list } = setup();
    addToFavorites(product("a"), list); // swipe right / «Сподобалось»
    toggleFavorite(product("b"), list); // heart on a catalogue tile
    addToFavorites(product("b"), list); // the same product liked in the feed
    expect(toggleFavorite(product("a"), list)).toBe("removed"); // heart again removes
    toggleFavorite(product("a"), list); // and adds back, still once
    expect(ids(list.read())).toEqual(["b", "a"]);
    expect(storage.getItem(LEGACY_SWIPE_FAVORITES_STORAGE_KEY)).toBeNull();
  });

  it("does not duplicate the same product", () => {
    const { list } = setup();
    addToFavorites(product("a"), list);
    addToFavorites(product("b"), list);
    expect(addToFavorites(product("a"), list)).toBe("already");
    expect(ids(list.read())).toEqual(["a", "b"]);
  });

  it("stores only the card fields, not the whole feed card", () => {
    const { list } = setup();
    addToFavorites({ ...product("a"), material: "льон" } as SavedProduct, list);
    expect(list.read()[0]).toEqual(product("a"));
  });

  it("«Прибрати» removes a product", () => {
    const { list } = setup();
    addToFavorites(product("a"), list);
    addToFavorites(product("b"), list);
    expect(ids(list.remove("a"))).toEqual(["b"]);
    expect(list.has("a")).toBe(false);
  });
});

describe("moving the old «Вподобане зі свайпів»", () => {
  it("merges the old swipe likes into «Вподобане» without duplicates and deletes the old key", () => {
    const storage = memoryStorage();
    storage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify({ version: 1, items: [product("b")] }),
    );
    storeLegacy(storage, [product("a"), product("b"), product("c")]);

    const list = createFavoriteList(() => storage);
    expect(ids(list.read())).toEqual(["b", "a", "c"]);
    expect(storage.getItem(LEGACY_SWIPE_FAVORITES_STORAGE_KEY)).toBeNull();
  });

  it("runs only once: a later start changes nothing", () => {
    const storage = memoryStorage();
    storeLegacy(storage, [product("a")]);
    const list = createFavoriteList(() => storage);
    list.remove("a");

    const reloaded = createFavoriteList(() => storage);
    expect(reloaded.read()).toEqual([]);
  });

  it("drops a broken old list without touching «Вподобане»", () => {
    const storage = memoryStorage();
    storage.setItem(LEGACY_SWIPE_FAVORITES_STORAGE_KEY, "{not json");
    addToFavorites(
      product("a"),
      createFavoriteList(() => storage),
    );
    migrateSwipeFavorites(() => storage);
    expect(storage.getItem(LEGACY_SWIPE_FAVORITES_STORAGE_KEY)).toBeNull();
    expect(ids(createFavoriteList(() => storage).read())).toEqual(["a"]);
  });

  it("keeps the old key when «Вподобане» could not be written", () => {
    const storage = memoryStorage();
    storeLegacy(storage, [product("a")]);
    const full: KeyValueStorage = {
      ...storage,
      setItem: () => {
        throw new Error("quota");
      },
    };
    migrateSwipeFavorites(() => full);
    expect(storage.getItem(LEGACY_SWIPE_FAVORITES_STORAGE_KEY)).not.toBeNull();
  });

  it("does nothing when storage is blocked", () => {
    const storage = brokenStorage();
    expect(() => createFavoriteList(() => storage)).not.toThrow();
  });
});

describe("persistence", () => {
  it("keeps the list after a reload (a new store over the same storage)", () => {
    const { storage, list } = setup();
    addToFavorites(product("a"), list);
    addToFavorites(product("b"), list);
    expect(ids(createFavoriteList(() => storage).read())).toEqual(["a", "b"]);
  });

  it("writes the list under its key with a version", () => {
    const { storage, list } = setup();
    addToFavorites(product("a"), list);
    expect(
      JSON.parse(storage.getItem(FAVORITES_STORAGE_KEY) ?? "null"),
    ).toEqual({ version: 1, items: [product("a")] });
  });

  it("reads broken JSON, another version or malformed items as empty", () => {
    const { storage, list } = setup();
    storage.setItem(FAVORITES_STORAGE_KEY, "{not json");
    expect(list.read()).toEqual([]);
    storage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify({ version: 2, items: [product("a")] }),
    );
    expect(list.read()).toEqual([]);
    storage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify({ version: 1, items: [product("a"), { id: 5 }] }),
    );
    expect(ids(list.read())).toEqual(["a"]);
  });

  it("returns the same array until the data changes (stable snapshot)", () => {
    const { list } = setup();
    addToFavorites(product("a"), list);
    const first = list.read();
    expect(list.read()).toBe(first);
    addToFavorites(product("b"), list);
    expect(list.read()).not.toBe(first);
  });

  it("sees a change written by another tab", () => {
    const { storage, list } = setup();
    const otherTab = createFavoriteList(() => storage);
    otherTab.add(product("a"));
    expect(ids(list.read())).toEqual(["a"]);
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
    const { list } = setup();
    const listener = vi.fn();
    const unsubscribe = list.subscribe(listener);
    list.add(product("a"));
    list.add(product("a"));
    list.remove("zzz");
    list.remove("a");
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    list.add(product("b"));
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
