import { describe, expect, it } from "vitest";
import type { FeedCard } from "../../api/types";
import { DEMO_FEED, demoPictureNumber, withDemoFallback } from "./demoFeed";

const apiCard: FeedCard = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Сукня",
  brandName: "Бренд",
  priceUah: 2400,
  photoUrl: "/api/images/x",
  productUrl: "https://brand.ua/x",
};

describe("withDemoFallback", () => {
  it("uses the API cards when there are any", () => {
    expect(withDemoFallback([apiCard], false, true)).toEqual({
      items: [apiCard],
      isDemo: false,
    });
  });

  it("shows demo cards in development when the feed is empty", () => {
    expect(withDemoFallback([], false, true)).toEqual({
      items: DEMO_FEED,
      isDemo: true,
    });
  });

  it("shows demo cards in development when the API failed", () => {
    expect(withDemoFallback(undefined, true, true).isDemo).toBe(true);
  });

  it("waits for the API while it is loading", () => {
    expect(withDemoFallback(undefined, false, true)).toEqual({
      items: [],
      isDemo: false,
    });
  });

  it("never shows demo cards in production", () => {
    expect(withDemoFallback([], false, false)).toEqual({
      items: [],
      isDemo: false,
    });
    expect(withDemoFallback(undefined, true, false).isDemo).toBe(false);
  });

  it("demo cards have unique ids and http(s) product links", () => {
    const ids = new Set(DEMO_FEED.map((card) => card.id));
    expect(ids.size).toBe(DEMO_FEED.length);
    for (const card of DEMO_FEED)
      expect(card.productUrl).toMatch(/^https?:\/\//);
  });
});

describe("demoPictureNumber", () => {
  it("numbers the demo cards from 1 in feed order", () => {
    expect(DEMO_FEED.map((card) => demoPictureNumber(card.id))).toEqual(
      DEMO_FEED.map((_, index) => index + 1),
    );
  });

  it("is null for a real card, so its photo is shown", () => {
    expect(demoPictureNumber(apiCard.id)).toBeNull();
  });

  it("demo cards load no photos from the network", () => {
    for (const card of DEMO_FEED) expect(card.photoUrl).toBe("");
  });
});
