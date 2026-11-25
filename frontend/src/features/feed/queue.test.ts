import { describe, expect, it } from "vitest";
import { brandOptions } from "../catalog/catalog";
import {
  currentCard,
  emptyProgress,
  feedBrandOptions,
  feedEndState,
  feedReducer,
  filteredQueue,
  pendingCards,
  swipeOutcome,
  type FeedProgress,
} from "./queue";

const items = [{ id: "1" }, { id: "2" }, { id: "3" }];

describe("feed queue", () => {
  it("starts with the first card in feed order", () => {
    expect(currentCard(items, emptyProgress)?.id).toBe("1");
  });

  it("like saves to favourites and shows the next card (US-09 S1)", () => {
    const state = feedReducer(emptyProgress, { type: "like", id: "1" });
    expect(state.favoriteIds).toEqual(["1"]);
    expect(state.viewedIds).toEqual(["1"]);
    expect(currentCard(items, state)?.id).toBe("2");
  });

  it("skip does not touch favourites (US-10 S1)", () => {
    const state = feedReducer(emptyProgress, { type: "skip", id: "1" });
    expect(state.favoriteIds).toEqual([]);
    expect(currentCard(items, state)?.id).toBe("2");
  });

  it("a second action on the same card is ignored (US-10 S2)", () => {
    let state = feedReducer(emptyProgress, { type: "skip", id: "1" });
    const afterFirst = state;
    state = feedReducer(state, { type: "skip", id: "1" });
    state = feedReducer(state, { type: "like", id: "1" });
    expect(state).toBe(afterFirst);
    expect(currentCard(items, state)?.id).toBe("2");
  });

  it("returns null when every card is viewed (US-08.1 S2)", () => {
    let state: FeedProgress = emptyProgress;
    for (const item of items)
      state = feedReducer(state, { type: "like", id: item.id });
    expect(currentCard(items, state)).toBeNull();
    expect(pendingCards(items, state)).toEqual([]);
  });

  it("returns null for an empty feed (US-08.1 CL)", () => {
    expect(currentCard([], emptyProgress)).toBeNull();
  });

  it("keeps the order when the feed is refetched with new cards", () => {
    const state = feedReducer(emptyProgress, { type: "skip", id: "1" });
    const refetched = [...items, { id: "4" }];
    expect(pendingCards(refetched, state).map((i) => i.id)).toEqual([
      "2",
      "3",
      "4",
    ]);
  });

  it("skips a card that is already in favourites", () => {
    const state: FeedProgress = { viewedIds: [], favoriteIds: ["1"] };
    expect(currentCard(items, state)?.id).toBe("2");
  });
});

describe("feed queue with the catalogue filters", () => {
  const cards = [
    { id: "m1", brandName: "MINT", priceUah: 1200 },
    { id: "g1", brandName: "Gunia", priceUah: 900 },
    { id: "m2", brandName: "Mint ", priceUah: 3400 },
    { id: "b1", brandName: "Barricade", priceUah: 2000 },
  ];
  const mint = { minPrice: null, maxPrice: null, brands: ["mint"], sizes: [] };
  const upTo2000 = { minPrice: null, maxPrice: 2000, brands: [], sizes: [] };
  const none = { minPrice: null, maxPrice: null, brands: [], sizes: [] };

  it("shows only the cards that pass the filters, in feed order", () => {
    expect(filteredQueue(cards, mint, emptyProgress).map((c) => c.id)).toEqual([
      "m1",
      "m2",
    ]);
    expect(
      filteredQueue(cards, upTo2000, emptyProgress).map((c) => c.id),
    ).toEqual(["m1", "g1", "b1"]);
  });

  it("never brings back a viewed card when the filters change", () => {
    let progress = feedReducer(emptyProgress, { type: "skip", id: "m1" });
    progress = feedReducer(progress, { type: "like", id: "g1" });
    expect(filteredQueue(cards, mint, progress).map((c) => c.id)).toEqual([
      "m2",
    ]);
    expect(filteredQueue(cards, none, progress).map((c) => c.id)).toEqual([
      "m2",
      "b1",
    ]);
    expect(filteredQueue(cards, upTo2000, progress).map((c) => c.id)).toEqual([
      "b1",
    ]);
  });

  it("tells «no new cards for these filters» from «everything viewed»", () => {
    expect(feedEndState(3, 2, 1)).toBe("cards");
    expect(feedEndState(3, 0, 1)).toBe("filtered");
    expect(feedEndState(0, 0, 1)).toBe("allViewed");
    expect(feedEndState(0, 0, 0)).toBe("allViewed");
  });

  it("counts brands over unviewed cards and keeps a chosen brand at 0", () => {
    const progress = feedReducer(
      feedReducer(emptyProgress, { type: "skip", id: "m1" }),
      { type: "skip", id: "m2" },
    );
    const pending = pendingCards(cards, progress);
    expect(feedBrandOptions(pending, brandOptions(cards), ["mint"])).toEqual([
      { key: "barricade", label: "Barricade", count: 1 },
      { key: "gunia", label: "Gunia", count: 1 },
      { key: "mint", label: "MINT", count: 0 },
    ]);
  });
});

describe("a like when «Вподобане» is full (25 for a guest)", () => {
  const full = Array.from({ length: 25 }, (_, i) => ({ id: `fav${i}` }));

  it("keeps the card on screen: not liked, not viewed", () => {
    const outcome = swipeOutcome(emptyProgress, full, "1", "right", 25);
    expect(outcome.blocked).toBe(true);
    expect(outcome.progress).toBe(emptyProgress);
    expect(currentCard(items, outcome.progress)?.id).toBe("1");
  });

  it("still lets the user skip the card", () => {
    const outcome = swipeOutcome(emptyProgress, full, "1", "left", 25);
    expect(outcome.blocked).toBe(false);
    expect(currentCard(items, outcome.progress)?.id).toBe("2");
  });

  it("likes a card that is already in «Вподобане», and any card below the limit", () => {
    const withCard = [...full.slice(0, 24), { id: "1" }];
    expect(
      swipeOutcome(emptyProgress, withCard, "1", "right", 25).blocked,
    ).toBe(false);
    expect(
      swipeOutcome(emptyProgress, full.slice(0, 24), "1", "right", 25).blocked,
    ).toBe(false);
  });
});
