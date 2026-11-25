import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import type { FeedCard, ProductSize } from "../../api/types";
import { CatalogTile } from "../../features/catalog/CatalogTile";
import { SwipeCard } from "../../features/feed/SwipeCard";
import { productCardTexts as t } from "../messages.uk";
import { withCurrentDetails, type SavedProduct } from "../productLists";
import { ProductModalView } from "../SavedProducts/ProductModal";
import { SavedProductsView } from "../SavedProducts/SavedProducts";
import { initialSavedProductsState } from "../SavedProducts/savedProductsState";
import { LOW_STOCK_SIZES, sizesInStock, stockHint } from "../sizes";
import { ProductCard } from "./ProductCard";
import { fitSizes, SizeRowView } from "./SizeRow";

const size = (label: string, available = true): ProductSize => ({
  label,
  available,
});

const base: FeedCard = {
  id: "p1",
  name: "Сукня льняна",
  brandName: "Бренд А",
  priceUah: 2400,
  photoUrl: "https://example.com/a.jpg",
  productUrl: "https://brand-a.example/dress",
};

/** 2 sizes in stock out of 4, written out of order. */
const fewCard: FeedCard = {
  ...base,
  sizes: [size("XL"), size("s", false), size("M"), size("L", false)],
};

/** The front side of a rendered card (the back is rendered too, hidden). */
function front(html: string): string {
  const back = html.search(/class="[^"]*_back[^a-zA-Z]/);
  return back < 0 ? html : html.slice(0, back);
}

function back(html: string): string {
  const start = html.search(/class="[^"]*_back[^a-zA-Z]/);
  return start < 0 ? "" : html.slice(start);
}

const card = (value: FeedCard) => renderToString(<ProductCard card={value} />);

describe("stockHint", () => {
  it("no sizes (brand-made cards) → null", () => {
    expect(stockHint(undefined)).toBeNull();
    expect(stockHint([])).toBeNull();
  });

  it("the threshold is 2", () => {
    expect(LOW_STOCK_SIZES).toBe(2);
  });

  it("3 or more in stock → null", () => {
    expect(
      stockHint([size("S"), size("M"), size("L"), size("XL", false)]),
    ).toBeNull();
    expect(
      stockHint([
        size("S"),
        size("M"),
        size("L"),
        size("XL"),
        size("XXL", false),
      ]),
    ).toBeNull();
  });

  it.each([2, 1])("%i in stock → few with that count", (count) => {
    const sizes = ["S", "M", "L"].map((label, index) =>
      size(label, index < count),
    );
    expect(stockHint([...sizes, size("XL", false)])).toEqual({
      kind: "few",
      count,
    });
  });

  it("all sold out → none", () => {
    expect(stockHint([size("S", false), size("M", false)])).toEqual({
      kind: "none",
    });
  });

  it("the same size written twice counts once", () => {
    expect(
      stockHint([size("m"), size("M "), size("XXL"), size("2XL")]),
    ).toEqual({ kind: "few", count: 2 });
  });
});

describe("badge texts", () => {
  it("uses the right forms", () => {
    expect(t.stockFew(3)).toBe("Залишилось 3 розміри");
    expect(t.stockFew(2)).toBe("Залишилось 2 розміри");
    expect(t.stockFew(1)).toBe("Залишився 1 розмір");
    expect(t.stockNone).toBe("Немає в наявності");
  });
});

/** The circles of a rendered row: the visible list (not the measuring copy). */
function circles(html: string): { label: string; items: string[] } | null {
  const match = html.match(
    /<ul[^>]*aria-label="(Доступні розміри[^"]*)"[^>]*>(.*?)<\/ul>/,
  );
  if (!match) return null;
  return {
    label: match[1] ?? "",
    items: [...(match[2] ?? "").matchAll(/<li[^>]*>([^<]+)<\/li>/g)].map(
      (item) => item[1] ?? "",
    ),
  };
}

const COUNT = /<span[^>]*_count[^>]*aria-hidden="true"[^>]*>(\d)<\/span>/;

describe("the front side: only the sizes in stock, as circles", () => {
  it("shows only available sizes, in the filter's order", () => {
    const row = circles(front(card(fewCard)));
    expect(row?.items).toEqual(["M", "XL"]);
  });

  it("labels the group in words: «Доступні розміри: M, XL. Залишилось 2 розміри»", () => {
    expect(circles(front(card(fewCard)))?.label).toBe(
      "Доступні розміри: M, XL. Залишилось 2 розміри",
    );
    expect(t.sizesInStockLabel(["S", "M", "L", "XL"], null)).toBe(
      "Доступні розміри: S, M, L, XL.",
    );
  });

  it("puts a red count (aria-hidden) over the group with 1–2 left", () => {
    expect(front(card(fewCard)).match(COUNT)?.[1]).toBe("2");
    const one = card({ ...base, sizes: [size("S", false), size("L")] });
    expect(front(one).match(COUNT)?.[1]).toBe("1");
  });

  it("has no count and no «Залишилось» with 3 in stock", () => {
    const html = front(
      card({
        ...base,
        sizes: [size("S"), size("M", false), size("L"), size("XL")],
      }),
    );
    expect(circles(html)?.items).toEqual(["S", "L", "XL"]);
    expect(html).not.toMatch(COUNT);
    expect(circles(html)?.label).toBe("Доступні розміри: S, L, XL.");
  });

  it("labels 1 left as «Залишився 1 розмір»", () => {
    const html = front(card({ ...base, sizes: [size("S", false), size("L")] }));
    expect(circles(html)?.label).toBe(
      "Доступні розміри: L. Залишився 1 розмір",
    );
  });

  it("has no count with 4 or more in stock", () => {
    const html = front(
      card({
        ...base,
        sizes: ["XS", "S", "M", "L"].map((label) => size(label)),
      }),
    );
    expect(circles(html)?.items).toEqual(["XS", "S", "M", "L"]);
    expect(html).not.toMatch(COUNT);
    expect(circles(html)?.label).toBe("Доступні розміри: XS, S, M, L.");
  });

  it("all sold out: the small grey «Немає в наявності» instead of circles", () => {
    const html = front(card({ ...base, sizes: [size("S", false)] }));
    expect(html).toMatch(/<p[^>]*_none[^>]*>Немає в наявності<\/p>/);
    expect(circles(html)).toBeNull();
  });

  it("shows nothing for a card without sizes", () => {
    const html = card(base);
    expect(html).not.toContain("Доступні розміри");
    expect(html).not.toContain("_none");
  });

  it("nothing about stock is on the photo any more", () => {
    for (const html of [
      card(fewCard),
      card({ ...base, sizes: [size("S", false)] }),
    ]) {
      expect(html).not.toContain("_badge");
      expect(html).not.toMatch(/>Залишил(ось|ся) \d/);
    }
  });

  it("is not a button: the swipe goes through it", () => {
    const css = readFileSync(
      "src/shared/ProductCard/SizeRow.module.css",
      "utf8",
    );
    expect(front(card(fewCard))).not.toMatch(/<button[^>]*>M</);
    expect(css).toMatch(/\.list,\s*\.measure\s*{[^}]*flex-wrap: nowrap/);
    expect(css).not.toMatch(/\.(dot|list|row)[^{]*{[^}]*pointer-events/);
  });

  it("no longer shows colours, material or description (they are on the back)", () => {
    const html = front(
      card({
        ...fewCard,
        colors: [{ name: "Молочний", hex: "#f5f0e6" }],
        material: "100% льон",
        description: "Вільний крій",
      }),
    );
    expect(html).not.toContain("Молочний");
    expect(html).not.toContain("100% льон");
    expect(html).not.toContain("Вільний крій");
  });
});

describe("«+N» when the circles do not fit in one line", () => {
  it("fitSizes keeps all when they fit, else leaves room for «+N»", () => {
    expect(fitSizes([30, 30, 30], 4, 200, 30)).toBe(3);
    // 30+4+30 = 64 fits with «+N» (30+4): 98 ≤ 100; a third would need 132
    expect(fitSizes([30, 30, 30, 30], 4, 100, 30)).toBe(2);
    expect(fitSizes([120], 4, 100, 30)).toBe(0);
  });

  it("shows the first circles and «+3»", () => {
    const sizes = sizesInStock(
      ["XL", "XS", "L", "S", "M"].map((label) => size(label)),
    );
    const html = renderToString(
      <SizeRowView sizes={sizes} hint={null} visible={2} variant="card" />,
    );
    const row = circles(html);
    expect(row?.items).toEqual(["XS", "S", "+3"]);
    expect(html).toMatch(/<li[^>]*aria-label="Ще 3 розміри"[^>]*>\+3<\/li>/);
    // the label still names every size in stock
    expect(row?.label).toBe("Доступні розміри: XS, S, M, L, XL.");
  });

  it("shows no «+N» when everything fits", () => {
    const html = renderToString(
      <SizeRowView
        sizes={[size("S")]}
        hint={{ kind: "few", count: 1 }}
        visible={1}
        variant="tile"
      />,
    );
    expect(circles(html)?.items).toEqual(["S"]);
  });
});

describe("the back side", () => {
  it("lists every size with «Немає в наявності» for sold-out ones, under a heading", () => {
    const html = back(card(fewCard));
    expect(html).toMatch(/<h3[^>]*>Розміри<\/h3>/);
    expect(html).toMatch(/>s<\/span><span[^>]*>Немає в наявності<\/span>/);
    expect(html).toMatch(/>L<\/span><span[^>]*>Немає в наявності<\/span>/);
    expect(html).toMatch(/>M<\/span><\/li>/);
  });

  it("shows colour, material and description only when they exist", () => {
    const full = back(
      card({
        ...base,
        colors: [{ name: "Молочний", hex: "#f5f0e6" }],
        material: "100% льон",
        description: "Вільний крій",
      }),
    );
    expect(full).toMatch(/<h3[^>]*>Колір<\/h3>.*Молочний/);
    expect(full).toMatch(/<h3[^>]*>Матеріал<\/h3><p[^>]*>100% льон/);
    expect(full).toMatch(/<h3[^>]*>Опис<\/h3><p[^>]*>Вільний крій/);

    const bare = back(card(base));
    for (const title of ["Розміри", "Колір", "Матеріал", "Опис"]) {
      expect(bare).not.toContain(`>${title}</h3>`);
    }
    expect(bare).toContain(`>${t.price}</h3>`);
    expect(bare).toContain(t.noDetails);
  });
});

/** The circles with the red «2» of fewCard. */
function hasFewSizes(html: string): boolean {
  return (
    circles(html)?.label === "Доступні розміри: M, XL. Залишилось 2 розміри" &&
    html.match(COUNT)?.[1] === "2"
  );
}

describe("the sizes and the count are everywhere the product is", () => {
  it("on the catalogue tile, in the row with the price", () => {
    const html = renderToString(
      <MemoryRouter>
        <CatalogTile card={fewCard} isFavorite={false} index={0} />
      </MemoryRouter>,
    );
    expect(hasFewSizes(html)).toBe(true);
    expect(html).toMatch(
      /_priceRow[^>]*><p[^>]*_price[^>]*>2400 грн<\/p><div[^>]*data-variant="tile"/,
    );
    expect(html).not.toContain("Залишилось 2 розміри</");
  });

  it("on the catalogue tile of a brand card: just the price", () => {
    const html = renderToString(
      <MemoryRouter>
        <CatalogTile card={base} isFavorite={false} index={0} />
      </MemoryRouter>,
    );
    expect(html).toMatch(
      /_priceRow[^>]*><p[^>]*_price[^>]*>2400 грн<\/p><\/div>/,
    );
  });

  it("on the swipe card", () => {
    const html = renderToString(
      <SwipeCard
        card={fewCard}
        exit={null}
        onSwipe={() => true}
        onExited={() => {}}
        flipped={false}
        onFlippedChange={() => {}}
      />,
    );
    expect(hasFewSizes(front(html))).toBe(true);
  });

  it("in the full card of the modal", () => {
    const html = renderToString(
      <ProductModalView
        product={fewCard}
        onClose={() => {}}
        titleId="t"
        reduceMotion
      />,
    );
    expect(hasFewSizes(html)).toBe(true);
  });

  it("on the cards of «Вподобане»", () => {
    const html = renderToString(
      SavedProductsView({
        titleId: "favorites-title",
        title: "Вподобане",
        items: [fewCard],
        emptyText: "Порожньо",
        emptyLinks: [{ to: "/feed", text: "Почати свайпати" }],
        listLabel: "Вподобані товари",
        removeLabel: (name) => `Прибрати: ${name}`,
        onRemove: vi.fn(),
        state: initialSavedProductsState,
        dispatch: vi.fn(),
        reduceMotion: true,
        requestFocus: vi.fn(),
      }),
    );
    expect(hasFewSizes(html)).toBe(true);
  });
});

describe("withCurrentDetails («Вподобане» takes sizes from the feed)", () => {
  const saved: SavedProduct = {
    id: base.id,
    name: base.name,
    brandName: base.brandName,
    priceUah: base.priceUah,
    photoUrl: base.photoUrl,
    productUrl: base.productUrl,
  };

  it("adds the current details of the same product", () => {
    expect(withCurrentDetails([saved], [fewCard])).toEqual([
      { ...saved, sizes: fewCard.sizes },
    ]);
  });

  it("keeps a product that is no longer in the feed as it was", () => {
    expect(withCurrentDetails([saved], [])).toEqual([saved]);
    expect(withCurrentDetails([saved], undefined)).toEqual([saved]);
  });
});
