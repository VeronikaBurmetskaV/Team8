import { useSyncExternalStore } from "react";
import type { PublicCard } from "../api/types";
import {
  browserStorage,
  safeGet,
  safeRemove,
  safeSet,
  type KeyValueStorage,
} from "./storage";

/**
 * «Вподобане»: the one list of liked products, kept only in this browser (localStorage)
 * under a versioned key. A like in the swipe feed and the heart in the catalogue both add
 * here; a product is never stored twice. The server is not involved yet.
 * Tabs stay in sync through the `storage` event.
 */
export const FAVORITES_STORAGE_KEY = "fulla.favorites.v1";
/**
 * The old separate «Вподобане зі свайпів» list. Read only once, by `migrateSwipeFavorites`,
 * which moves its items into «Вподобане» and deletes the key.
 */
export const LEGACY_SWIPE_FAVORITES_STORAGE_KEY = "fulla.swipeFavorites.v1";

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

/**
 * One-time move of the old «Вподобане зі свайпів» into «Вподобане»: items already there keep
 * their place, the rest are added after them without duplicates. The old key is deleted only
 * when every item is safely stored in «Вподобане», so nothing is lost if storage is full.
 */
export function migrateSwipeFavorites(
  getStorage: () => KeyValueStorage | undefined = browserStorage,
): void {
  const storage = getStorage();
  if (safeGet(storage, LEGACY_SWIPE_FAVORITES_STORAGE_KEY) === null) return;
  const legacy = createProductList(
    LEGACY_SWIPE_FAVORITES_STORAGE_KEY,
    getStorage,
  );
  const target = createProductList(FAVORITES_STORAGE_KEY, getStorage);
  legacy.read().forEach((product) => target.add(product));
  // A fresh reader sees only what really reached the storage.
  const stored = createProductList(FAVORITES_STORAGE_KEY, getStorage);
  if (legacy.read().every((product) => stored.has(product.id))) {
    safeRemove(storage, LEGACY_SWIPE_FAVORITES_STORAGE_KEY);
  }
}

/** «Вподобане» over a storage, after moving the old swipe list in; tests pass an in-memory one. */
export function createFavoriteList(
  getStorage: () => KeyValueStorage | undefined = browserStorage,
): ProductList {
  migrateSwipeFavorites(getStorage);
  return createProductList(FAVORITES_STORAGE_KEY, getStorage);
}

/** The app's shared «Вподобане». */
export const favoriteList = createFavoriteList();

/**
 * Adds a product to «Вподобане»: a like in the swipe feed (swipe right or «Сподобалось»)
 * and the heart in the catalogue. Adding the same product again changes nothing.
 */
export function addToFavorites(
  product: SavedProduct,
  list: ProductList = favoriteList,
): readonly SavedProduct[] {
  return list.add(product);
}

/**
 * The heart on a catalogue tile: adds through `addToFavorites`, a second click removes.
 * Returns true when the product is in «Вподобане» afterwards.
 */
export function toggleFavorite(
  product: SavedProduct,
  list: ProductList = favoriteList,
): boolean {
  if (list.has(product.id)) {
    list.remove(product.id);
    return false;
  }
  addToFavorites(product, list);
  return true;
}

/** The current items of a list; re-renders on changes in this tab and in other tabs. */
export function useProductList(list: ProductList): readonly SavedProduct[] {
  return useSyncExternalStore(list.subscribe, list.read, () => EMPTY);
}
