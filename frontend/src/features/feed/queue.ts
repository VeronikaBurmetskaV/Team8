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
