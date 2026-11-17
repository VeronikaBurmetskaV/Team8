import { describe, expect, it } from "vitest";
import { LANGUAGE_STORAGE_KEY, readLanguage, saveLanguage } from "./language";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("language preference", () => {
  it("defaults to UA when nothing is stored", () => {
    expect(readLanguage(memoryStorage())).toBe("UA");
  });

  it("remembers the saved choice", () => {
    const storage = memoryStorage();
    saveLanguage("EN", storage);
    expect(storage.getItem(LANGUAGE_STORAGE_KEY)).toBe("EN");
    expect(readLanguage(storage)).toBe("EN");
  });

  it("ignores an unknown stored value", () => {
    const storage = memoryStorage();
    storage.setItem(LANGUAGE_STORAGE_KEY, "DE");
    expect(readLanguage(storage)).toBe("UA");
  });

  it("survives a storage that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readLanguage(broken)).toBe("UA");
    expect(() => saveLanguage("EN", broken)).not.toThrow();
  });

  it("works without any storage", () => {
    expect(readLanguage(undefined)).toBe("UA");
  });
});
