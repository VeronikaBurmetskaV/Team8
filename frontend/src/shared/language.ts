/**
 * The UA / EN choice of the buyer header. For now it is only remembered in localStorage;
 * translating the pages is a separate task (i18n is postponed in the ADRs).
 */
export const LANGUAGES = ["UA", "EN"] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_STORAGE_KEY = "fulla.language.v1";

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;

function defaultStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    // Access can throw in private mode or with blocked site data.
    return undefined;
  }
}

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some((language) => language === value);
}

/** The saved language, or UA when nothing valid is stored or storage is unavailable. */
export function readLanguage(storage = defaultStorage()): Language {
  try {
    const saved = storage?.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(saved) ? saved : "UA";
  } catch {
    return "UA";
  }
}

export function saveLanguage(
  language: Language,
  storage = defaultStorage(),
): void {
  try {
    storage?.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Not saving is fine: the choice simply is not remembered.
  }
}
