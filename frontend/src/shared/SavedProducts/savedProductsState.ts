/**
 * What the «Вподобане» list shows over itself: the full card of one product (`openId`) and the
 * «Впевнені, що хочете видалити товар?» question about one product (`confirmId`).
 * Kept free of React so the tests can step through it in node.
 */
export interface SavedProductsState {
  openId: string | null;
  confirmId: string | null;
}

export type SavedProductsAction =
  /** A click, Enter or Space on a compact card. */
  | { type: "open"; id: string }
  /** The «×» of the full card, Esc or a click on the dimmed page. */
  | { type: "close" }
  /** The «×» on a photo. */
  | { type: "askRemove"; id: string }
  /** «Скасувати», Esc or a click outside the question; also after «Видалити». */
  | { type: "closeQuestion" };

export const initialSavedProductsState: SavedProductsState = {
  openId: null,
  confirmId: null,
};

export function savedProductsReducer(
  state: SavedProductsState,
  action: SavedProductsAction,
): SavedProductsState {
  switch (action.type) {
    case "open":
      return { openId: action.id, confirmId: null };
    case "close":
      return { ...state, openId: null };
    case "askRemove":
      return { openId: null, confirmId: action.id };
    case "closeQuestion":
      return { ...state, confirmId: null };
  }
}
