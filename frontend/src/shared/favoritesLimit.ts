import { useSyncExternalStore } from "react";

/**
 * How many products «Вподобане» holds (ADR-0012). The one place of these numbers on the
 * frontend; the backend has FavoritesService.FAVORITES_LIMIT_ACCOUNT.
 */
export const FAVORITES_LIMIT_GUEST = 25;
export const FAVORITES_LIMIT_ACCOUNT = 100;

/** Fewer free places than this: the counter on /favorites turns to the warning colour. */
export const FAVORITES_WARNING_LEFT = 3;

export interface FavoritesLimit {
  limit: number;
  /** A registered buyer is logged in (their «Вподобане» is on the server). */
  isAccount: boolean;
}

/**
 * The limit for the person using the page: a guest keeps 25 in this browser, a registered
 * buyer 100 on the server.
 *
 * TODO(US-03): buyer login is not built yet, so everyone is a guest. Once there is a buyer
 * session (useSession().data?.accountType === "BUYER"), return FAVORITES_LIMIT_ACCOUNT here.
 */
export function useFavoritesLimit(): FavoritesLimit {
  return { limit: FAVORITES_LIMIT_GUEST, isAccount: false };
}

/** True when the counter shows the warning colour: ≤ FAVORITES_WARNING_LEFT places left. */
export function isNearLimit(count: number, limit: number): boolean {
  return limit - count <= FAVORITES_WARNING_LEFT;
}

/* ---------- «Вподобане заповнене»: one dialog for the whole app ---------- */

let dialogOpen = false;
const listeners = new Set<() => void>();

function setDialogOpen(open: boolean) {
  if (dialogOpen === open) return;
  dialogOpen = open;
  listeners.forEach((listener) => listener());
}

/** A like or a heart hit the limit: show FavoritesLimitDialog (rendered once in Layout). */
export function showFavoritesLimit(): void {
  setDialogOpen(true);
}

export function hideFavoritesLimit(): void {
  setDialogOpen(false);
}

export function useFavoritesLimitOpen(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => dialogOpen,
    () => false,
  );
}
