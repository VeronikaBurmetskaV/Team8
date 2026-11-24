import { describe, expect, it } from "vitest";
import {
  BATCH_DELAY_CAP_MS,
  LOAD_DELAY_CAP_MS,
  LOAD_PHASE_MS,
  cardRevealDelay,
  effectiveRevealDelay,
  revealDelay,
} from "./reveal";

describe("cardRevealDelay", () => {
  it("staggers cards by 70 ms after the toolbar, in reading order", () => {
    expect(cardRevealDelay(0)).toBe(revealDelay.cards);
    expect(cardRevealDelay(1)).toBe(revealDelay.cards + 70);
    expect(cardRevealDelay(2)).toBe(revealDelay.cards + 140);
  });

  it("caps the delay so every visible card has started within ~1 s", () => {
    expect(cardRevealDelay(20)).toBe(LOAD_DELAY_CAP_MS);
    expect(cardRevealDelay(1000)).toBeLessThanOrEqual(LOAD_DELAY_CAP_MS);
  });
});

describe("effectiveRevealDelay", () => {
  it("uses the element's own delay at the start of the page load", () => {
    expect(effectiveRevealDelay(revealDelay.bannerCta, 0, 5)).toBe(600);
  });

  it("keeps one timeline for elements that mount later during the load", () => {
    // Cards that appear 300 ms after the header still start at 800 ms of the timeline.
    expect(effectiveRevealDelay(800, 300, 0)).toBe(500);
    expect(effectiveRevealDelay(100, 300, 0)).toBe(0);
  });

  it("after the load phase reveals a batch with a short, capped stagger", () => {
    const later = LOAD_PHASE_MS + 5000;
    expect(effectiveRevealDelay(800, later, 0)).toBe(0);
    expect(effectiveRevealDelay(800, later, 2)).toBe(140);
    expect(effectiveRevealDelay(800, later, 50)).toBe(BATCH_DELAY_CAP_MS);
  });
});
