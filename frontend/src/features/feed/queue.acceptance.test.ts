/**
 * Acceptance tests of the swipe feed (US-10 skip, US-09 like): the scenarios of the stories with
 * their card numbers. Swipe, buttons and keys all go through feedReducer / swipeOutcome (BR-11).
 */
import { describe, expect, it } from "vitest";
import {
  addToFavorites,
  createFavoriteList,
  type SavedProduct,
} from "../../shared/productLists";
import { memoryStorage } from "../../shared/testStorage";
import {
  currentCard,
  emptyProgress,
  feedReducer,
  pendingCards,
  swipeOutcome,
  type FeedProgress,
} from "./queue";

/** Cards №1…№8 in feed order. */
const feed = Array.from({ length: 8 }, (_, i) => ({ id: `card-${i + 1}` }));
const card = (n: number) => `card-${n}`;

/** Progress after skipping cards №1…№(n-1): card №n is on screen. */
function onScreen(n: number): FeedProgress {
  let progress = emptyProgress;
  for (let i = 1; i < n; i++) {
    progress = feedReducer(progress, { type: "skip", id: card(i) });
  }
  expect(currentCard(feed, progress)?.id).toBe(card(n));
  return progress;
}

describe("US-10 S1: skipping an uninteresting card", () => {
  it.each(["left", "button"] as const)(
    "skip of №5 (%s) leaves «Вподобане» unchanged and shows №6",
    (way) => {
      const before = onScreen(5);
      const after =
        way === "left"
          ? swipeOutcome(before, [], card(5), "left", Infinity).progress
          : feedReducer(before, { type: "skip", id: card(5) });

      expect(after.favoriteIds).toEqual(before.favoriteIds);
      expect(after.viewedIds).toContain(card(5));
      expect(currentCard(feed, after)?.id).toBe(card(6));
    },
  );
});

describe("US-10 S2: a fast double press of «Пропустити»", () => {
  it("only №5 is skipped and №6 stays on screen", () => {
    let progress = onScreen(5);
    // both presses still target the card that was on screen when they started
    const afterFirst = feedReducer(progress, { type: "skip", id: card(5) });
    progress = feedReducer(afterFirst, { type: "skip", id: card(5) });

    // the second press changes nothing: the skip is counted for №5 once
    expect(progress).toBe(afterFirst);
    expect(currentCard(feed, progress)?.id).toBe(card(6));
    expect(progress.viewedIds).not.toContain(card(6));
  });

  it("a swipe and a button press on the same card count once", () => {
    let progress = onScreen(5);
    progress = swipeOutcome(progress, [], card(5), "left", Infinity).progress;
    progress = feedReducer(progress, { type: "skip", id: card(5) });

    expect(progress.viewedIds.filter((id) => id === card(5))).toHaveLength(1);
    expect(currentCard(feed, progress)?.id).toBe(card(6));
  });
});

describe("US-10 CL: a skipped card is viewed for this session", () => {
  it("does not come back when the feed is loaded again", () => {
    const progress = feedReducer(onScreen(5), { type: "skip", id: card(5) });
    const refetched = [...feed, { id: card(9) }];

    expect(pendingCards(refetched, progress).map((c) => c.id)).not.toContain(
      card(5),
    );
  });
});

describe("US-09: liking a card", () => {
  function product(id: string): SavedProduct {
    return {
      id,
      name: `Сукня ${id}`,
      brandName: "Бренд",
      priceUah: 2400,
      photoUrl: `https://img.example/${id}.jpg`,
      productUrl: `https://brand.example/${id}`,
    };
  }

  it("S1: like of №1 adds it to «Вподобане» (+1) and shows №2", () => {
    const storage = memoryStorage();
    const list = createFavoriteList(() => storage);
    const progress = swipeOutcome(
      emptyProgress,
      list.read(),
      card(1),
      "right",
      Infinity,
    ).progress;
    addToFavorites(product(card(1)), list);

    expect(progress.favoriteIds).toEqual([card(1)]);
    expect(list.read()).toHaveLength(1);
    expect(currentCard(feed, progress)?.id).toBe(card(2));
  });

  it("CL: liking the same card twice keeps one entry", () => {
    const storage = memoryStorage();
    const list = createFavoriteList(() => storage);
    let progress = feedReducer(emptyProgress, { type: "like", id: card(1) });
    progress = feedReducer(progress, { type: "like", id: card(1) });
    addToFavorites(product(card(1)), list);
    addToFavorites(product(card(1)), list);

    expect(progress.favoriteIds).toEqual([card(1)]);
    expect(list.read()).toHaveLength(1);
  });

  it("S2: three liked products stay in «Вподобане» after a reload", () => {
    const storage = memoryStorage();
    const list = createFavoriteList(() => storage);
    for (const n of [1, 2, 3]) addToFavorites(product(card(n)), list);

    const afterReload = createFavoriteList(() => storage);

    expect(afterReload.read().map((p) => p.id)).toEqual([
      card(1),
      card(2),
      card(3),
    ]);
  });
});
