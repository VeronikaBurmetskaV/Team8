import { describe, expect, it, vi } from "vitest";
import { createProductList, type SavedProduct } from "./productLists";
import { createSeenTracker } from "./newItems";
import { headerTexts } from "./messages.uk";
import { brokenStorage, memoryStorage } from "./testStorage";
import type { KeyValueStorage } from "./storage";

const LIST_KEY = "test.list.v1";
const SEEN_KEY = "test.list.seen.v1";

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

/** A list and its tracker over one storage; a second call with the same storage = a reload. */
function open(storage: KeyValueStorage) {
  const list = createProductList(LIST_KEY, () => storage);
  const tracker = createSeenTracker(list, SEEN_KEY, () => storage);
  return { list, tracker };
}

describe("new items of a product list", () => {
  it("counts additions since the page was last opened", () => {
    const { list, tracker } = open(memoryStorage());
    ["a", "b", "c", "d"].forEach((id) => list.add(product(id)));
    expect(tracker.newCount()).toBe(4);

    tracker.markAllSeen(); // the buyer opens the page
    expect(tracker.newCount()).toBe(0);

    list.add(product("e"));
    expect(tracker.newCount()).toBe(1);
  });

  it("removing a new item lowers the counter, removing a seen one does not", () => {
    const { list, tracker } = open(memoryStorage());
    list.add(product("a"));
    list.add(product("b"));
    tracker.markAllSeen();
    list.add(product("c"));
    expect(tracker.newCount()).toBe(1);

    list.remove("a"); // seen before
    tracker.forgetRemoved();
    expect(tracker.newCount()).toBe(1);

    list.remove("c"); // still new
    tracker.forgetRemoved();
    expect(tracker.newCount()).toBe(0);
  });

  it("a seen product removed and added again counts as new", () => {
    const { list, tracker } = open(memoryStorage());
    list.add(product("a"));
    tracker.markAllSeen();
    list.remove("a");
    tracker.forgetRemoved();
    list.add(product("a"));
    expect(tracker.newCount()).toBe(1);
  });

  it("keeps the state across a reload", () => {
    const storage = memoryStorage();
    const first = open(storage);
    ["a", "b"].forEach((id) => first.list.add(product(id)));
    first.tracker.markAllSeen();
    first.list.add(product("c"));

    const reloaded = open(storage);
    expect(reloaded.tracker.newCount()).toBe(1);
  });

  it("notifies on changes of the list and of the seen IDs", () => {
    const { list, tracker } = open(memoryStorage());
    const listener = vi.fn();
    const unsubscribe = tracker.subscribe(listener);
    list.add(product("a"));
    tracker.markAllSeen();
    expect(listener).toHaveBeenCalledTimes(2);
    tracker.markAllSeen(); // nothing new: no write, no call
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    list.add(product("b"));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("reads broken stored data as nothing seen", () => {
    const storage = memoryStorage();
    const { list, tracker } = open(storage);
    list.add(product("a"));
    storage.setItem(SEEN_KEY, "{not json");
    expect(tracker.newCount()).toBe(1);
    storage.setItem(SEEN_KEY, JSON.stringify({ version: 2, ids: ["a"] }));
    expect(tracker.newCount()).toBe(1);
  });

  it("still works for the page view when storage is blocked", () => {
    const { list, tracker } = open(brokenStorage());
    list.add(product("a"));
    expect(tracker.newCount()).toBe(1);
    tracker.markAllSeen();
    expect(tracker.newCount()).toBe(0);
  });

  it("the icon's accessible name says how many items are new", () => {
    expect(headerTexts.withCount("Вподобане", 0)).toBe("Вподобане");
    expect(headerTexts.withCount("Вподобане", 1)).toBe(
      "Вподобане: 1 новий товар",
    );
    expect(headerTexts.withCount("Вподобане", 3)).toBe(
      "Вподобане: 3 нові товари",
    );
    expect(headerTexts.withCount("Вподобане", 11)).toBe(
      "Вподобане: 11 нових товарів",
    );
  });
});
