import { describe, expect, it } from "vitest";
import type { BrandCard } from "../../api/types";
import {
  draftIds,
  filterCards,
  filterParam,
  isImported,
  parseFilter,
  selectedDrafts,
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

describe("the filter", () => {
  it("«Чернетки з сайту» keeps only imported drafts", () => {
    expect(filterCards(cards, "imported-drafts").map((c) => c.id)).toEqual([
      "a",
    ]);
    expect(filterCards(cards, "all")).toHaveLength(3);
    expect(isImported(cards[0]!)).toBe(true);
    expect(isImported(cards[2]!)).toBe(false);
  });

  it("lives in ?filter=imported", () => {
    expect(parseFilter("imported")).toBe("imported-drafts");
    expect(parseFilter(null)).toBe("all");
    expect(parseFilter("anything")).toBe("all");
    expect(filterParam("imported-drafts")).toBe("imported");
    expect(filterParam("all")).toBeNull();
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
    expect(selectedDrafts(new Set(["a", "b", "x"]), draftIds(cards))).toEqual([
      "a",
    ]);
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
