import { describe, expect, it } from "vitest";
import {
  closesOnKey,
  COLLAPSE_SCROLL_PX,
  headerReducer,
  INITIAL_HEADER_STATE,
  markerEvent,
  type HeaderEvent,
  type HeaderState,
} from "./headerState";

function run(events: HeaderEvent[], from = INITIAL_HEADER_STATE): HeaderState {
  return events.reduce(headerReducer, from);
}

const compact = run([{ type: "leftTop" }]);
const expandedAt = (y: number) => run([{ type: "toggle", y }], compact);

describe("headerReducer", () => {
  it("starts with the full header", () => {
    expect(INITIAL_HEADER_STATE.mode).toBe("full");
  });

  it("shows the thin bar once the full header has scrolled away", () => {
    expect(compact.mode).toBe("compact");
  });

  it("goes back to the full header at the top, from any state", () => {
    expect(run([{ type: "reachedTop" }], compact).mode).toBe("full");
    expect(run([{ type: "reachedTop" }], expandedAt(500)).mode).toBe("full");
  });

  it("opens and closes the header with the arrow", () => {
    const open = expandedAt(500);
    expect(open).toEqual({ mode: "expanded", anchorY: 500 });
    expect(run([{ type: "toggle", y: 500 }], open).mode).toBe("compact");
  });

  it("ignores the arrow when there is no bar", () => {
    expect(run([{ type: "toggle", y: 0 }])).toBe(INITIAL_HEADER_STATE);
  });

  it("closes on Esc, a click outside or another page (collapse)", () => {
    expect(run([{ type: "collapse" }], expandedAt(500)).mode).toBe("compact");
    // Nothing to close: the same object, no re-render.
    expect(headerReducer(compact, { type: "collapse" })).toBe(compact);
    expect(headerReducer(INITIAL_HEADER_STATE, { type: "collapse" })).toBe(
      INITIAL_HEADER_STATE,
    );
  });

  it(`closes after scrolling down more than ${COLLAPSE_SCROLL_PX}px`, () => {
    const open = expandedAt(500);
    expect(
      run([{ type: "scroll", y: 500 + COLLAPSE_SCROLL_PX }], open).mode,
    ).toBe("expanded");
    expect(
      run([{ type: "scroll", y: 500 + COLLAPSE_SCROLL_PX + 1 }], open).mode,
    ).toBe("compact");
  });

  it("counts the scroll from the lowest point after scrolling up", () => {
    const state = run(
      [
        { type: "scroll", y: 300 },
        { type: "scroll", y: 330 },
      ],
      expandedAt(500),
    );
    expect(state).toEqual({ mode: "expanded", anchorY: 300 });
    expect(run([{ type: "scroll", y: 341 }], state).mode).toBe("compact");
  });

  it("does not react to scroll unless expanded", () => {
    expect(headerReducer(compact, { type: "scroll", y: 9999 })).toBe(compact);
  });

  it("leftTop while expanded keeps it open", () => {
    const open = expandedAt(500);
    expect(headerReducer(open, { type: "leftTop" })).toBe(open);
  });
});

describe("markerEvent", () => {
  it("visible marker = top of the page", () => {
    expect(
      markerEvent({ isIntersecting: true, boundingClientRect: { top: 90 } }),
    ).toEqual({ type: "reachedTop" });
  });

  it("marker above the window = scrolled past the header", () => {
    expect(
      markerEvent({ isIntersecting: false, boundingClientRect: { top: -5 } }),
    ).toEqual({ type: "leftTop" });
  });

  it("marker below the window = nothing", () => {
    expect(
      markerEvent({ isIntersecting: false, boundingClientRect: { top: 900 } }),
    ).toBeNull();
  });
});

describe("closesOnKey", () => {
  it("Esc closes the expanded header", () => {
    expect(closesOnKey("expanded", "Escape", false)).toBe(true);
  });

  it("Esc first closes a menu or list open inside it", () => {
    expect(closesOnKey("expanded", "Escape", true)).toBe(false);
  });

  it("other keys and other states do nothing", () => {
    expect(closesOnKey("expanded", "Enter", false)).toBe(false);
    expect(closesOnKey("compact", "Escape", false)).toBe(false);
    expect(closesOnKey("full", "Escape", false)).toBe(false);
  });
});
