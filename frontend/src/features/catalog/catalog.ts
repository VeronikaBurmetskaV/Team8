/** Pure logic of the catalogue page: paging by «Показати ще» and the filter panel state. */

/** Tiles shown at first and added by each «Показати ще». */
export const CATALOG_PAGE_SIZE = 24;

/** How many tiles are shown after one more «Показати ще» (never more than there are). */
export function nextVisibleCount(visible: number, total: number): number {
  return Math.min(visible + CATALOG_PAGE_SIZE, total);
}

/** True while some products are still hidden behind «Показати ще». */
export function hasMore(visible: number, total: number): boolean {
  return visible < total;
}

export type FilterPanelAction =
  | { type: "toggle" }
  | { type: "close" }
  /** A key pressed while the panel is open: only Escape closes it. */
  | { type: "key"; key: string };

/** Open/closed state of the filter panel: «Фільтри» toggles; ✕, Escape and the backdrop close. */
export function filterPanelReducer(
  open: boolean,
  action: FilterPanelAction,
): boolean {
  switch (action.type) {
    case "toggle":
      return !open;
    case "close":
      return false;
    case "key":
      return action.key === "Escape" ? false : open;
  }
}
