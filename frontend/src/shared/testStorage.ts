import type { KeyValueStorage } from "./storage";

/** In-memory localStorage for unit tests. */
export function memoryStorage(): KeyValueStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

/** A storage that throws on every call, like a blocked one in private mode. */
export function brokenStorage(): KeyValueStorage {
  const fail = () => {
    throw new Error("blocked");
  };
  return { getItem: fail, setItem: fail, removeItem: fail };
}
