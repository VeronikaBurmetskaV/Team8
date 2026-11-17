import { useSyncExternalStore } from "react";
import type { PublicCard } from "../api/types";
import {
  browserStorage,
  safeGet,
  safeSet,
  type KeyValueStorage,
} from "./storage";

/**
 * Two lists of liked products, kept only in this browser (localStorage), each under its own
 * versioned key. The server is not involved yet.
 * - «Вподобане зі свайпів»: every like in the swipe feed lands here.
 * - «Вподобане»: only what the buyer explicitly adds (from «Вподобане зі свайпів», later the catalogue).
 * Tabs stay in sync through the `storage` event.
 */
export const SWIPE_FAVORITES_STORAGE_KEY = "fulla.swipeFavorites.v1";
export const FAVORITES_STORAGE_KEY = "fulla.favorites.v1";

/** What a list keeps of a product: only the card fields, never the whole feed card. */
export type SavedProduct = Pick<
  PublicCard,
  "id" | "name" | "brandName" | "priceUah" | "photoUrl" | "productUrl"
>;

interface StoredList {
  version: 1;
  items: SavedProduct[];
}

const EMPTY: readonly SavedProduct[] = [];

function isSavedProduct(value: unknown): value is SavedProduct {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.brandName === "string" &&
    typeof item.priceUah === "number" &&
    typeof item.photoUrl === "string" &&
    typeof item.productUrl === "string"
  );
}

/** Broken JSON, another version or a foreign shape read as an empty list. */
function parseList(raw: string | null): readonly SavedProduct[] {
  if (raw === null) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (parsed as { version?: unknown }).version !== 1
    ) {
      return EMPTY;
    }
    const items = (parsed as { items?: unknown }).items;
    return Array.isArray(items) ? items.filter(isSavedProduct) : EMPTY;
  } catch {
    return EMPTY;
  }
}

export interface ProductList {
  readonly storageKey: string;
  /** The saved items, oldest first. The same array is returned until the data changes. */
  read(): readonly SavedProduct[];
  has(id: string): boolean;
  /** Adds a product once; the same ID again changes nothing. Returns the new list. */
  add(product: SavedProduct): readonly SavedProduct[];
  /** Removes a product by ID. Returns the new list. */
  remove(id: string): readonly SavedProduct[];
  /** Called on every change: in this tab and, via the `storage` event, in other tabs. */
  subscribe(listener: () => void): () => void;
}

export function createProductList(
  storageKey: string,
  getStorage: () => KeyValueStorage | undefined = browserStorage,
): ProductList {
  const listeners = new Set<() => void>();
  let lastRaw: string | null = null;
  let lastItems: readonly SavedProduct[] = EMPTY;
  // If the storage is blocked, the list still works for this page view.
  let memory: readonly SavedProduct[] | null = null;

  function read(): readonly SavedProduct[] {
    if (memory !== null) return memory;
    const raw = safeGet(getStorage(), storageKey);
    if (raw !== lastRaw) {
      lastRaw = raw;
      lastItems = parseList(raw);
    }
    return lastItems;
  }

  function write(items: readonly SavedProduct[]): readonly SavedProduct[] {
    const value: StoredList = { version: 1, items: [...items] };
    const raw = JSON.stringify(value);
    const storage = getStorage();
    safeSet(storage, storageKey, raw);
    memory = safeGet(storage, storageKey) === raw ? null : items;
    listeners.forEach((listener) => listener());
    return read();
  }

  return {
    storageKey,
    read,
    has: (id) => read().some((item) => item.id === id),
    add(product) {
      const items = read();
      if (items.some((item) => item.id === product.id)) return items;
      return write([
        ...items,
        {
          id: product.id,
          name: product.name,
          brandName: product.brandName,
          priceUah: product.priceUah,
          photoUrl: product.photoUrl,
          productUrl: product.productUrl,
        },
      ]);
    },
    remove(id) {
      const items = read();
      if (!items.some((item) => item.id === id)) return items;
      return write(items.filter((item) => item.id !== id));
    },
    subscribe(listener) {
      listeners.add(listener);
      function onStorage(event: StorageEvent) {
        // `key` is null when another tab cleared the whole storage.
        if (event.key === null || event.key === storageKey) listener();
      }
      const target = typeof window === "undefined" ? undefined : window;
      target?.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        target?.removeEventListener("storage", onStorage);
      };
    },
  };
}

export interface FavoriteLists {
  swipeFavorites: ProductList;
  favorites: ProductList;
}

/** Both lists over one storage; tests pass an in-memory one. */
export function createFavoriteLists(
  getStorage: () => KeyValueStorage | undefined = browserStorage,
): FavoriteLists {
  return {
    swipeFavorites: createProductList(SWIPE_FAVORITES_STORAGE_KEY, getStorage),
    favorites: createProductList(FAVORITES_STORAGE_KEY, getStorage),
  };
}

/** The app's shared store of both lists. */
export const favoriteLists = createFavoriteLists();

/** A like in the swipe feed: saved ONLY to «Вподобане зі свайпів», never to «Вподобане». */
export function addSwipeLike(
  product: SavedProduct,
  lists: FavoriteLists = favoriteLists,
): readonly SavedProduct[] {
  return lists.swipeFavorites.add(product);
}

/**
 * Explicit «Додати у Вподобане»: from «Вподобане зі свайпів» now, from the catalogue later.
 * Adding the same product again changes nothing.
 */
export function addToFavorites(
  product: SavedProduct,
  lists: FavoriteLists = favoriteLists,
): readonly SavedProduct[] {
  return lists.favorites.add(product);
}

/** The current items of a list; re-renders on changes in this tab and in other tabs. */
export function useProductList(list: ProductList): readonly SavedProduct[] {
  return useSyncExternalStore(list.subscribe, list.read, () => EMPTY);
}
