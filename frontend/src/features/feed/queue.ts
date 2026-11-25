/**
 * The card queue of the swipe feed (US-08.1, US-09, US-10, INV-05).
 *
 * Decisions are keyed by card ID, not by timers: a second like/skip for an ID that is
 * already decided is ignored, so a fast double press never skips the next card (US-10 S2).
 * Swipe, buttons and keyboard all dispatch the same actions (BR-11).
 *
 * Not persisted yet: saving progress and «Вподобане» to localStorage is a separate task
 * (features/feed/session.ts in CLAUDE.md §3).
 */
import { favoriteAddResult } from "../../shared/productLists";
import {
  brandOptions,
  filterCatalog,
  type BrandOption,
  type CatalogFilters,
} from "../catalog/catalog";
export interface FeedProgress {
  viewedIds: readonly string[];
  favoriteIds: readonly string[];
}

export type FeedAction =
  { type: "like"; id: string } | { type: "skip"; id: string };

export const emptyProgress: FeedProgress = { viewedIds: [], favoriteIds: [] };

export function feedReducer(
  state: FeedProgress,
  action: FeedAction,
): FeedProgress {
  if (state.viewedIds.includes(action.id)) return state;
  const viewedIds = [...state.viewedIds, action.id];
  if (action.type === "skip") return { ...state, viewedIds };
  const favoriteIds = state.favoriteIds.includes(action.id)
    ? state.favoriteIds
    : [...state.favoriteIds, action.id];
  return { viewedIds, favoriteIds };
}

function isDecided(progress: FeedProgress, id: string): boolean {
  return progress.viewedIds.includes(id) || progress.favoriteIds.includes(id);
}

/** Cards not yet liked or skipped, in feed order (brands mixed round by round by the API). */
export function pendingCards<T extends { id: string }>(
  items: readonly T[],
  progress: FeedProgress,
): T[] {
  return items.filter((item) => !isDecided(progress, item.id));
}

/** The card to show now, or null when everything is viewed («Ви переглянули всі…»). */
export function currentCard<T extends { id: string }>(
  items: readonly T[],
  progress: FeedProgress,
): T | null {
  return items.find((item) => !isDecided(progress, item.id)) ?? null;
}

/* ---------- Filters on /feed (the catalogue's, shared through the URL) ---------- */

type FilterableCard = { id: string; priceUah: number; brandName: string };

/**
 * The swipe queue under the filters: unviewed cards that pass them, in feed order. Progress is
 * never reset by a filter change, so a viewed card never comes back.
 */
export function filteredQueue<T extends FilterableCard>(
  items: readonly T[],
  filters: CatalogFilters,
  progress: FeedProgress,
): T[] {
  return pendingCards(filterCatalog(items, filters), progress);
}

/**
 * The «Бренд» group of the /feed drawer counts unviewed cards (not the whole catalogue). A
 * chosen brand with nothing left stays in the list with 0, so it can still be unticked.
 */
export function feedBrandOptions(
  pending: readonly { brandName: string }[],
  all: readonly BrandOption[],
  selected: readonly string[],
): BrandOption[] {
  const options = brandOptions(pending);
  const present = new Set(options.map((option) => option.key));
  for (const key of selected) {
    if (present.has(key)) continue;
    const known = all.find((option) => option.key === key);
    if (known) options.push({ ...known, count: 0 });
  }
  return options.sort((a, b) => a.label.localeCompare(b.label, "uk"));
}

/**
 * Which end of the feed to show when there is no card: «За цими фільтрами нових карток немає»
 * (filters hide the unviewed cards) or «Ви переглянули всі…» (nothing unviewed at all).
 */
export function feedEndState(
  pendingAll: number,
  pendingFiltered: number,
  activeFilters: number,
): "cards" | "filtered" | "allViewed" {
  if (pendingFiltered > 0) return "cards";
  return activeFilters > 0 && pendingAll > 0 ? "filtered" : "allViewed";
}

/**
 * What a swipe does to the queue. A like (swipe right, «Сподобалось», →) of a NEW product while
 * «Вподобане» is full is blocked: the progress stays as it is, so the card stays on screen and
 * is not counted as viewed (the user may skip it or free a place). A like of a product already
 * in «Вподобане», and every skip, work as always.
 */
export function swipeOutcome(
  progress: FeedProgress,
  favorites: readonly { id: string }[],
  cardId: string,
  direction: "left" | "right",
  limit: number,
): { progress: FeedProgress; blocked: boolean } {
  if (
    direction === "right" &&
    favoriteAddResult(favorites, cardId, limit) === "limit"
  ) {
    return { progress, blocked: true };
  }
  return {
    progress: feedReducer(progress, {
      type: direction === "right" ? "like" : "skip",
      id: cardId,
    }),
    blocked: false,
  };
}
