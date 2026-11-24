/*
 * States of the buyer header (BuyerHeader.tsx), pure so the rules are tested without a DOM.
 *
 *   full      — at the top of the page: the full header in the page flow, no bar.
 *   compact   — the full header has scrolled away: a thin bar is fixed at the top.
 *   expanded  — the bar's arrow opened the full header over the content under the bar.
 *
 * The full header never leaves the page flow, so switching states never moves the page.
 */

export type HeaderMode = "full" | "compact" | "expanded";

export type HeaderState = {
  mode: HeaderMode;
  /** Expanded only: the lowest scroll position since opening; scrolling further down than
   * COLLAPSE_SCROLL_PX from it closes the header again. */
  anchorY: number;
};

export type HeaderEvent =
  /** The marker under the full header left the top of the window. */
  | { type: "leftTop" }
  /** The marker is visible again: back at the top of the page. */
  | { type: "reachedTop" }
  /** The bar's arrow (or the bar itself) was clicked; `y` = window.scrollY. */
  | { type: "toggle"; y: number }
  /** Esc, a click outside, another page. */
  | { type: "collapse" }
  /** The page scrolled while the header is expanded; `y` = window.scrollY. */
  | { type: "scroll"; y: number };

/** How far the page may scroll down under the expanded header before it closes. */
export const COLLAPSE_SCROLL_PX = 40;

export const INITIAL_HEADER_STATE: HeaderState = { mode: "full", anchorY: 0 };

const COMPACT: HeaderState = { mode: "compact", anchorY: 0 };

/** Next state. Returns the same object when nothing changes, so React skips the render. */
export function headerReducer(
  state: HeaderState,
  event: HeaderEvent,
): HeaderState {
  switch (event.type) {
    case "leftTop":
      return state.mode === "full" ? COMPACT : state;
    case "reachedTop":
      return state.mode === "full" ? state : INITIAL_HEADER_STATE;
    case "toggle":
      if (state.mode === "compact") {
        return { mode: "expanded", anchorY: event.y };
      }
      return state.mode === "expanded" ? COMPACT : state;
    case "collapse":
      return state.mode === "expanded" ? COMPACT : state;
    case "scroll":
      if (state.mode !== "expanded") return state;
      if (event.y - state.anchorY > COLLAPSE_SCROLL_PX) return COMPACT;
      // Scrolling up moves the anchor, so "further down" is counted from the lowest point.
      return event.y < state.anchorY
        ? { mode: "expanded", anchorY: event.y }
        : state;
  }
}

/** The parts of an IntersectionObserverEntry the header reads. */
export type MarkerEntry = {
  isIntersecting: boolean;
  boundingClientRect: { top: number };
};

/**
 * Event for an IntersectionObserver entry of the marker under the full header: visible → top
 * of the page; above the window → scrolled past the header. Below the window (cannot happen
 * at the top of a page) → nothing.
 */
export function markerEvent(entry: MarkerEntry): HeaderEvent | null {
  if (entry.isIntersecting) return { type: "reachedTop" };
  return entry.boundingClientRect.top < 0 ? { type: "leftTop" } : null;
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
