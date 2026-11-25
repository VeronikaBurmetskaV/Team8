import { describe, expect, it } from "vitest";
import type { BrandCard } from "../../api/types";
import {
  draftIds,
  displayStatus,
  isNotOnSite,
  listOrder,
  rowClickToggles,
  selectedDrafts,
  splitNotOnSite,
  toCardFormValues,
  toggle,
  toggleAll,
} from "./productList";

function card(
  id: string,
  status: BrandCard["status"],
  imported = false,
): BrandCard {
  return {
    id,
    name: `Товар ${id}`,
    brandName: "Goldi",
    priceUah: 1000,
    photoUrl: "https://cdn.goldi.ua/a.jpg",
    productUrl: "https://goldi.ua/a",
    photoImageId: null,
    status,
    publishedAt: null,
    createdAt: "2026-11-25T10:00:00Z",
    ...(imported
      ? { sourceUrl: "https://goldi.ua/products.json", editedFields: [] }
      : {}),
  };
}

const cards = [
  card("a", "DRAFT", true),
  card("b", "PUBLISHED", true),
  card("c", "DRAFT"),
];

describe("the list", () => {
  it("always shows every card, in the server's order", () => {
    expect(listOrder(cards).map((c) => c.id)).toEqual(["a", "b", "c"]);
  });
});

describe("selection", () => {
  it("toggles one card", () => {
    const one = toggle(new Set(), "a");
    expect([...one]).toEqual(["a"]);
    expect([...toggle(one, "a")]).toEqual([]);
  });

  it("«вибрати всі» selects every shown draft, then clears them", () => {
    const drafts = draftIds(cards);
    expect(drafts).toEqual(["a", "c"]);
    const all = toggleAll(new Set(), drafts);
    expect([...all].sort()).toEqual(["a", "c"]);
    expect([...toggleAll(all, drafts)]).toEqual([]);
  });

  it("publishes only the selected cards that are shown drafts", () => {
    expect(selectedDrafts(new Set(["a", "b", "x"]), cards)).toEqual(["a"]);
  });
});

describe("«Немає на сайті» (ADR-0017)", () => {
  const gone: BrandCard = {
    ...card("g", "DRAFT", true),
    notOnSiteSince: "2026-11-30T10:00:00Z",
  };
  const list = [gone, ...cards];

  it("is its own status, at the end of the list", () => {
    expect(isNotOnSite(gone)).toBe(true);
    expect(displayStatus(gone)).toBe("NOT_ON_SITE");
    expect(displayStatus(cards[1]!)).toBe("PUBLISHED");
    expect(listOrder(list).map((c) => c.id)).toEqual(["a", "b", "c", "g"]);
  });

  it("can't be selected with «вибрати всі» nor published with «Опублікувати всі»", () => {
    expect(draftIds(list)).toEqual(["a", "c"]);
    expect([...toggleAll(new Set(), draftIds(list))]).not.toContain("g");
  });

  it("a selected card that went missing is reported as skipped, not sent", () => {
    const ids = selectedDrafts(new Set(["a", "g"]), list);
    expect(ids).toEqual(["g", "a"]);
    expect(splitNotOnSite(ids, list)).toEqual({
      publish: ["a"],
      notOnSite: ["g"],
    });
  });
});

describe("a click on the row", () => {
  it("toggles, except on links, buttons and form controls", () => {
    // Without a DOM: the target only needs closest().
    const fake = (inside: boolean) => ({
      closest: (selector: string) =>
        inside && selector.includes("button") ? {} : null,
    });
    expect(rowClickToggles(fake(false))).toBe(true);
    expect(rowClickToggles(fake(true))).toBe(false);
    expect(rowClickToggles(null)).toBe(true);
  });
});

describe("toCardFormValues", () => {
  it("keeps an uploaded photo as it is and shows an external URL", () => {
    expect(
      toCardFormValues({ ...card("a", "DRAFT"), photoImageId: "img" }).photo,
    ).toEqual({
      file: null,
      url: "",
    });
    expect(toCardFormValues(card("a", "DRAFT"))).toEqual({
      name: "Товар a",
      priceUah: "1000",
      photo: { file: null, url: "https://cdn.goldi.ua/a.jpg" },
      productUrl: "https://goldi.ua/a",
    });
  });
});
