import { useEffect, useSyncExternalStore } from "react";
import { favoriteList, useProductList, type ProductList } from "./productLists";
import {
  browserStorage,
  safeGet,
  safeSet,
  type KeyValueStorage,
} from "./storage";

/**
 * «New» items of a product list: the ones added after the buyer last opened the list's page.
 * The IDs already seen on the page are kept in this browser under a separate versioned key,
 * so the header counter survives a reload and stays in sync between tabs.
 */
export const FAVORITES_SEEN_STORAGE_KEY = "fulla.favorites.seen.v1";

interface StoredSeen {
  version: 1;
  ids: string[];
}

const NO_IDS: readonly string[] = [];

/** Broken JSON, another version or a foreign shape read as «nothing seen yet». */
function parseSeen(raw: string | null): readonly string[] {
  if (raw === null) return NO_IDS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (parsed as { version?: unknown }).version !== 1
    ) {
      return NO_IDS;
    }
    const ids = (parsed as { ids?: unknown }).ids;
    return Array.isArray(ids)
      ? ids.filter((id): id is string => typeof id === "string")
      : NO_IDS;
  } catch {
    return NO_IDS;
  }
}

export interface SeenTracker {
  /** How many items of the list are not seen yet. The badge hides it at 0. */
  newCount(): number;
  /** Opening the page: everything now in the list counts as seen. */
  markAllSeen(): void;
  /**
   * Drops seen IDs that are no longer in the list, so a product removed and later added
   * again counts as new. Removing an item never changes the counter.
   */
  forgetRemoved(): void;
  /** Called when the list or the seen IDs change (this tab and other tabs). */
  subscribe(listener: () => void): () => void;
}

export function createSeenTracker(
  list: ProductList,
  storageKey: string,
  getStorage: () => KeyValueStorage | undefined = browserStorage,
): SeenTracker {
  const listeners = new Set<() => void>();
  let lastRaw: string | null = null;
  let lastIds: readonly string[] = NO_IDS;
  // If the storage is blocked, the seen IDs still work for this page view.
  let memory: readonly string[] | null = null;

  function readSeen(): readonly string[] {
    if (memory !== null) return memory;
    const raw = safeGet(getStorage(), storageKey);
    if (raw !== lastRaw) {
      lastRaw = raw;
      lastIds = parseSeen(raw);
    }
    return lastIds;
  }

  function writeSeen(ids: readonly string[]): void {
    const value: StoredSeen = { version: 1, ids: [...ids] };
    const raw = JSON.stringify(value);
    const storage = getStorage();
    safeSet(storage, storageKey, raw);
    memory = safeGet(storage, storageKey) === raw ? null : ids;
    listeners.forEach((listener) => listener());
  }

  function sameIds(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((id, index) => id === b[index]);
  }

  return {
    newCount() {
      const seen = new Set(readSeen());
      return list.read().filter((item) => !seen.has(item.id)).length;
    },
    markAllSeen() {
      const ids = list.read().map((item) => item.id);
      if (!sameIds(ids, readSeen())) writeSeen(ids);
    },
    forgetRemoved() {
      const inList = new Set(list.read().map((item) => item.id));
      const seen = readSeen();
      const kept = seen.filter((id) => inList.has(id));
      if (kept.length !== seen.length) writeSeen(kept);
    },
    subscribe(listener) {
      listeners.add(listener);
      const unsubscribeList = list.subscribe(listener);
      function onStorage(event: StorageEvent) {
        if (event.key === null || event.key === storageKey) listener();
      }
      const target = typeof window === "undefined" ? undefined : window;
      target?.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        unsubscribeList();
        target?.removeEventListener("storage", onStorage);
      };
    },
  };
}

/** New items of «Вподобане» since /favorites was last opened. */
export const favoritesSeen = createSeenTracker(
  favoriteList,
  FAVORITES_SEEN_STORAGE_KEY,
);

/**
 * The header counter of a list. While its page is open (`pageOpen`), every item counts as
 * seen, so the badge is hidden and items added meanwhile do not show up later as new.
 */
export function useNewItemsCount(
  list: ProductList,
  tracker: SeenTracker,
  pageOpen: boolean,
): number {
  const items = useProductList(list);
  const count = useSyncExternalStore(
    tracker.subscribe,
    tracker.newCount,
    () => 0,
  );

  useEffect(() => {
    if (pageOpen) tracker.markAllSeen();
    else tracker.forgetRemoved();
  }, [items, pageOpen, tracker]);

  return pageOpen ? 0 : count;
}
