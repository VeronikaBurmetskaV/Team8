/*
 * States of the buyer header (BuyerHeader.tsx), pure so the rules are tested without a DOM.
 *
 *   full      — at the top of the page: the full header.
 *   compact   — the page has scrolled past the full header: a thin bar.
 *   expanded  — the bar's arrow turned the bar back into the full header, fixed over the
 *               content (the "compactExpanded" state): one header, one logo, not a copy.
 *
 * The header is always fixed at the top; a spacer of the full header's height keeps its place
 * in the page flow in every state, so switching states never moves the page and can never
 * feed back into the scroll position. The state depends on window.scrollY only.
 */

export type HeaderMode = "full" | "compact" | "expanded";

export type HeaderState = {
  mode: HeaderMode;
  /** Expanded only: the lowest scroll position since opening; scrolling further down than
   * COLLAPSE_SCROLL_PX from it closes the header again. */
  anchorY: number;
};

export type HeaderEvent =
  /**
   * The page scrolled (read once per animation frame). `y` = window.scrollY, `maxY` = the
   * largest real scroll position, `fullHeight` = the height of the full header (its spacer).
   */
  | { type: "scroll"; y: number; maxY: number; fullHeight: number }
  /** The bar's arrow (or the bar itself) was clicked; `y` = window.scrollY. */
  | { type: "toggle"; y: number }
  /** Esc, a click outside, another page. */
  | { type: "collapse" };

/** How far the page may scroll down under the expanded header before it closes. */
export const COLLAPSE_SCROLL_PX = 40;

/**
 * Hysteresis of full ↔ compact, by window.scrollY only. The bar appears once the page has
 * scrolled past the whole full header plus COMPACT_AFTER_PX, and the full header comes back
 * only within FULL_BEFORE_PX of the top. Between the two nothing changes, so a scroll position
 * hovering around one threshold can never make the header flip back and forth.
 */
export const COMPACT_AFTER_PX = 16;
export const FULL_BEFORE_PX = 8;

export const INITIAL_HEADER_STATE: HeaderState = { mode: "full", anchorY: 0 };

const COMPACT: HeaderState = { mode: "compact", anchorY: 0 };

/**
 * window.scrollY limited to [0, maxY]: rubber-band overscroll on macOS / iOS reports values
 * below 0 or above the end of the page, which must not count as scrolling.
 */
export function clampScroll(y: number, maxY: number): number {
  if (!Number.isFinite(y)) return 0;
  return Math.min(Math.max(y, 0), Math.max(maxY, 0));
}

/** Next state. Returns the same object when nothing changes, so React skips the render. */
export function headerReducer(
  state: HeaderState,
  event: HeaderEvent,
): HeaderState {
  switch (event.type) {
    case "toggle":
      if (state.mode === "compact") {
        return { mode: "expanded", anchorY: event.y };
      }
      return state.mode === "expanded" ? COMPACT : state;
    case "collapse":
      return state.mode === "expanded" ? COMPACT : state;
    case "scroll": {
      const y = clampScroll(event.y, event.maxY);
      if (y < FULL_BEFORE_PX) {
        return state.mode === "full" ? state : INITIAL_HEADER_STATE;
      }
      switch (state.mode) {
        case "full":
          return y > event.fullHeight + COMPACT_AFTER_PX ? COMPACT : state;
        case "compact":
          return state;
        case "expanded":
          if (y - state.anchorY > COLLAPSE_SCROLL_PX) return COMPACT;
          // Scrolling up moves the anchor, so "further down" is counted from the lowest point.
          return y < state.anchorY ? { mode: "expanded", anchorY: y } : state;
      }
    }
  }
}

/**
 * Esc closes the expanded header, unless something opened inside it (the burger menu with
 * city and language, a dropdown list) is open: that closes first, on its own.
 */
export function closesOnKey(
  mode: HeaderMode,
  key: string,
  nestedOpen: boolean,
): boolean {
  return mode === "expanded" && key === "Escape" && !nestedOpen;
}
