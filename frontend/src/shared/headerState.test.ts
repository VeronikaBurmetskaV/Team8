import { describe, expect, it } from "vitest";
import {
  clampScroll,
  closesOnKey,
  COLLAPSE_SCROLL_PX,
  COMPACT_AFTER_PX,
  FULL_BEFORE_PX,
  headerReducer,
  INITIAL_HEADER_STATE,
  type HeaderEvent,
  type HeaderState,
} from "./headerState";

const FULL_HEIGHT = 128;
const MAX_Y = 5000;
const scroll = (y: number): HeaderEvent => ({
  type: "scroll",
  y,
  maxY: MAX_Y,
  fullHeight: FULL_HEIGHT,
});

function run(events: HeaderEvent[], from = INITIAL_HEADER_STATE): HeaderState {
  return events.reduce(headerReducer, from);
}

const compact = run([scroll(600)]);
const expandedAt = (y: number) => run([{ type: "toggle", y }], compact);

describe("headerReducer: full ↔ compact by window.scrollY with hysteresis", () => {
  it("starts with the full header", () => {
    expect(INITIAL_HEADER_STATE.mode).toBe("full");
  });

  it("shows the bar only past the whole full header + 16px", () => {
    expect(run([scroll(FULL_HEIGHT + COMPACT_AFTER_PX)]).mode).toBe("full");
    expect(run([scroll(FULL_HEIGHT + COMPACT_AFTER_PX + 1)]).mode).toBe(
      "compact",
    );
  });

  it("goes back to the full header only within 8px of the top", () => {
    expect(run([scroll(FULL_BEFORE_PX)], compact).mode).toBe("compact");
    expect(run([scroll(FULL_BEFORE_PX - 1)], compact).mode).toBe("full");
    expect(run([scroll(0)], expandedAt(500)).mode).toBe("full");
  });

  it("does not flip when the scroll position hovers around a threshold", () => {
    // around the bar's threshold (144): one switch when clearly past it, none back
    const nearDown = [140, 146, 143, 145, 140, 146, 141].map(scroll);
    let state = INITIAL_HEADER_STATE;
    const modes = nearDown.map(
      (event) => (state = headerReducer(state, event)).mode,
    );
    expect(modes).toEqual([
      "full",
      "compact",
      "compact",
      "compact",
      "compact",
      "compact",
      "compact",
    ]);

    // what used to loop (y 70 → 0 with the page jumping): compact until the top 8px, once
    const nearUp = [70, 64, 58, 52, 160, 30, 120, 9, 7, 12, 3].map(scroll);
    state = compact;
    const up = nearUp.map(
      (event) => (state = headerReducer(state, event)).mode,
    );
    expect(up.indexOf("full")).toBe(8);
    expect(up.slice(8).every((mode) => mode === "full")).toBe(true);
  });

  it("treats rubber-band overscroll as the edge of the page", () => {
    // below 0 at the top: the full header, from any state
    expect(run([scroll(-70)], compact).mode).toBe("full");
    expect(run([scroll(-70)]).mode).toBe("full");
    // past the end at the bottom: still the bar, never a flip
    expect(run([scroll(MAX_Y + 90)], compact).mode).toBe("compact");
    expect(clampScroll(-40, MAX_Y)).toBe(0);
    expect(clampScroll(MAX_Y + 40, MAX_Y)).toBe(MAX_Y);
    expect(clampScroll(Number.NaN, MAX_Y)).toBe(0);
  });

  it("returns the same object when nothing changes (no re-render)", () => {
    expect(headerReducer(compact, scroll(900))).toBe(compact);
    expect(headerReducer(INITIAL_HEADER_STATE, scroll(3))).toBe(
      INITIAL_HEADER_STATE,
    );
  });
});

describe("headerReducer: the expanded header", () => {
  it("opens and closes the header with the arrow", () => {
    const open = expandedAt(600);
    expect(open.mode).toBe("expanded");
    expect(run([{ type: "toggle", y: 600 }], open).mode).toBe("compact");
  });

  it("ignores the arrow when there is no bar", () => {
    expect(run([{ type: "toggle", y: 0 }]).mode).toBe("full");
  });

  it("closes on Esc, a click outside or another page (collapse)", () => {
    expect(run([{ type: "collapse" }], expandedAt(600)).mode).toBe("compact");
    expect(run([{ type: "collapse" }])).toBe(INITIAL_HEADER_STATE);
  });

  it(`closes after scrolling down more than ${COLLAPSE_SCROLL_PX}px`, () => {
    const open = expandedAt(600);
    expect(run([scroll(600 + COLLAPSE_SCROLL_PX)], open).mode).toBe("expanded");
    expect(run([scroll(600 + COLLAPSE_SCROLL_PX + 1)], open).mode).toBe(
      "compact",
    );
  });

  it("counts the scroll from the lowest point after scrolling up", () => {
    const state = run([scroll(500), scroll(530)], expandedAt(600));
    expect(state).toEqual({ mode: "expanded", anchorY: 500 });
    expect(run([scroll(541)], state).mode).toBe("compact");
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
