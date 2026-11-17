/** The part of localStorage the app needs; tests pass an in-memory one. */
export type KeyValueStorage = Pick<
  globalThis.Storage,
  "getItem" | "setItem" | "removeItem"
>;

/** localStorage, or undefined when the browser blocks it (private mode, blocked site data). */
export function browserStorage(): KeyValueStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/** Reads a value; any storage failure counts as «nothing stored». */
export function safeGet(
  storage: KeyValueStorage | undefined,
  key: string,
): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Writes a value; not saving (quota, blocked storage) is never an error for the UI. */
export function safeSet(
  storage: KeyValueStorage | undefined,
  key: string,
  value: string,
): void {
  try {
    storage?.setItem(key, value);
  } catch {
    // The value simply is not remembered.
  }
}
