/**
 * The two tabs of /login. The active one lives in the URL: /login = buyer (default),
 * /login?tab=brand = brand, so a reload or a shared link keeps it.
 */
export const LOGIN_TABS = ["buyer", "brand"] as const;
export type LoginTab = (typeof LOGIN_TABS)[number];

/** Any value other than "brand" (missing, misspelt) means the default buyer tab. */
export function parseLoginTab(search: URLSearchParams): LoginTab {
  return search.get("tab") === "brand" ? "brand" : "buyer";
}

/** The address of a tab: "/login" or "/login?tab=brand". */
export function loginPath(tab: LoginTab): string {
  return tab === "brand" ? "/login?tab=brand" : "/login";
}

/**
 * WAI-ARIA tabs keyboard: ←/→ move to the other tab (wrapping), Home/End to the first/last.
 * Returns null for keys the tablist does not handle.
 */
export function tabForKey(key: string, current: LoginTab): LoginTab | null {
  const index = LOGIN_TABS.indexOf(current);
  const last = LOGIN_TABS.length - 1;
  let next: number;
  switch (key) {
    case "ArrowRight":
      next = index === last ? 0 : index + 1;
      break;
    case "ArrowLeft":
      next = index === 0 ? last : index - 1;
      break;
    case "Home":
      next = 0;
      break;
    case "End":
      next = last;
      break;
    default:
      return null;
  }
  return LOGIN_TABS[next] ?? null;
}
