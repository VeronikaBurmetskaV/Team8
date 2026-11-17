import { describe, expect, it } from "vitest";
import {
  currentCard,
  emptyProgress,
  feedReducer,
  pendingCards,
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
