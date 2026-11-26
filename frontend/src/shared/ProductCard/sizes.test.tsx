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
import {
  LOW_STOCK_QUANTITY,
  lowStockQuantity,
  sizesInStock,
  stockHint,
  uniqueSizes,
} from "../sizes";
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

  it("any size in stock → null: the number of sizes left is never a stock hint", () => {
    for (const count of [1, 2, 3, 4]) {
      const sizes = ["S", "M", "L", "XL"].map((label, index) =>
        size(label, index < count),
      );
      expect(stockHint([...sizes, size("XXL", false)])).toBeNull();
    }
    // the same size written twice
    expect(stockHint([size("m"), size("M "), size("XXL", false)])).toBeNull();
  });

  it("all sold out → none", () => {
    expect(stockHint([size("S", false), size("M", false)])).toEqual({
      kind: "none",
    });
  });
});

describe("size texts", () => {
  it("has no «Залишилось N розміри» any more", () => {
    expect(t).not.toHaveProperty("stockFew");
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

/** The old aggregate red count over the size row (removed: it counted sizes, not items). */
const COUNT = /class="[^"]*_count[^"]*"[^>]*aria-hidden="true"/;

describe("the front side: every size as circles, sold-out ones struck through", () => {
  it("shows every size in the filter's order, sold-out ones included", () => {
    const row = circles(front(card(fewCard)));
    expect(row?.items).toEqual(["s", "M", "L", "XL"]);
  });

  it("marks sold-out circles for the grey strikethrough and names them for screen readers", () => {
    const html = front(card(fewCard));
    const visible =
      html.match(
        /<ul[^>]*aria-label="Доступні розміри[^"]*"[^>]*>(.*?)<\/ul>/,
      )?.[1] ?? "";
    expect(visible).toMatch(
      /<li[^>]*data-available="false"[^>]*aria-label="s, Немає в наявності"[^>]*>s<\/li>/,
    );
    expect(visible).toMatch(
      /<li[^>]*data-available="false"[^>]*aria-label="L, Немає в наявності"[^>]*>L<\/li>/,
    );
    expect(visible).toMatch(/<li[^>]*data-available="true"[^>]*>M<\/li>/);
    expect(visible).not.toMatch(/aria-label="M, /);
  });

  it("styles a sold-out circle like the back side's sold-out pill", () => {
    const css = readFileSync(
      "src/shared/ProductCard/SizeRow.module.css",
      "utf8",
    );
    const rule =
      css.match(/\.dot\[data-available="false"\]\s*{([^}]*)}/)?.[1] ?? "";
    expect(rule).toContain("border-color: var(--color-gray-border);");
    expect(rule).toContain("background-color: var(--color-offwhite);");
    expect(rule).toContain("color: var(--color-gray-text);");
    expect(rule).toContain("text-decoration: line-through;");
    expect(rule).not.toMatch(/border-width|padding|width/);
  });

  it("labels the group in words with the sizes in stock only: «Доступні розміри: M, XL.»", () => {
    expect(circles(front(card(fewCard)))?.label).toBe(
      "Доступні розміри: M, XL.",
    );
    expect(t.sizesInStockLabel(["S", "M", "L", "XL"])).toBe(
      "Доступні розміри: S, M, L, XL.",
    );
  });

  it.each([1, 2, 3, 4])(
    "%i in stock: no aggregate red count and no «Залишилось»",
    (count) => {
      const sizes = ["XS", "S", "M", "L"].map((label, index) =>
        size(label, index < count),
      );
      const html = front(card({ ...base, sizes }));
      expect(circles(html)?.items).toEqual(["XS", "S", "M", "L"]);
      expect(html).not.toMatch(COUNT);
      expect(html).not.toMatch(/Залишил(ось|ся)/);
    },
  );

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

  it("counts sold-out sizes in «+N» on the card; the label still names only those in stock", () => {
    const html = renderToString(
      <SizeRowView
        sizes={uniqueSizes(fewCard.sizes ?? [])}
        hint={stockHint(fewCard.sizes)}
        visible={2}
        variant="card"
      />,
    );
    const row = circles(html);
    expect(row?.items).toEqual(["s", "M", "+2"]);
    expect(row?.label).toBe("Доступні розміри: M, XL.");
    // the measuring copy carries the same marks, so it measures the same circles
    expect(html).toMatch(
      /<ul[^>]*aria-hidden="true"[^>]*>.*<li[^>]*data-available="false"[^>]*>L<\/li>/,
    );
  });

  it("shows no «+N» when everything fits", () => {
    const html = renderToString(
      <SizeRowView
        sizes={[size("S")]}
        hint={null}
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

/** The size circles of fewCard (M and XL in stock), with no aggregate red count anywhere. */
function hasSizesWithoutCount(html: string): boolean {
  return (
    circles(html)?.label === "Доступні розміри: M, XL." &&
    !COUNT.test(html) &&
    !/Залишил(ось|ся)/.test(html)
  );
}

describe("the sizes are everywhere the product is, never with an aggregate count", () => {
  it("on the catalogue tile, in the row with the price", () => {
    const html = renderToString(
      <MemoryRouter>
        <CatalogTile card={fewCard} isFavorite={false} index={0} />
      </MemoryRouter>,
    );
    expect(hasSizesWithoutCount(html)).toBe(true);
    expect(html).toMatch(
      /_priceRow[^>]*><p[^>]*_price[^>]*>2400 грн<\/p><div[^>]*data-variant="tile"/,
    );
    expect(html).not.toContain("Залишилось 2 розміри</");
  });

  it("on the catalogue tile: only the sizes in stock, no sold-out circles", () => {
    const html = renderToString(
      <MemoryRouter>
        <CatalogTile card={fewCard} isFavorite={false} index={0} />
      </MemoryRouter>,
    );
    expect(circles(html)?.items).toEqual(["M", "XL"]);
    expect(html).not.toContain('data-available="false"');
    expect(html).not.toContain("Немає в наявності");
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
    expect(hasSizesWithoutCount(front(html))).toBe(true);
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
    expect(hasSizesWithoutCount(html)).toBe(true);
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
    expect(hasSizesWithoutCount(html)).toBe(true);
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

describe("the photo of the card is never cropped (US-08.1 CL, A-14)", () => {
  const css = readFileSync(
    "src/shared/ProductCard/ProductCard.module.css",
    "utf8",
  );

  it("shows the whole photo, centred, on neutral bands", () => {
    expect(css).toMatch(/\.photo\s*{[^}]*object-fit: contain;/);
    expect(css).toMatch(/\.photo\s*{[^}]*object-position: center;/);
    expect(css).not.toMatch(/object-fit: cover/);
    expect(css).toMatch(
      /\.photoBox\s*{[^}]*background-color: var\(--color-offwhite\);/,
    );
  });

  it("leaves the catalogue tile's 3:4 crop as it is", () => {
    const tile = readFileSync(
      "src/features/catalog/CatalogTile.module.css",
      "utf8",
    );
    expect(tile).toMatch(/\.photo\s*{[^}]*object-fit: cover;/);
  });
});

describe("uniqueSizes (the card's circles) and sizesInStock (the tile's)", () => {
  it("keeps every size once, in the filter's order, with its availability", () => {
    expect(uniqueSizes(fewCard.sizes ?? [])).toEqual([
      size("s", false),
      size("M"),
      size("L", false),
      size("XL"),
    ]);
  });

  it("a size is in stock when any spelling is; it keeps the first spelling in stock", () => {
    const sizes = [
      size("M", false),
      size("m"),
      size("2XL", false),
      size("XXL", false),
    ];
    expect(uniqueSizes(sizes)).toEqual([size("m"), size("2XL", false)]);
    expect(sizesInStock(sizes)).toEqual([size("m")]);
  });

  it("drops empty labels and returns nothing for no sizes", () => {
    expect(uniqueSizes([size(" "), size("S", false)])).toEqual([
      size("S", false),
    ]);
    expect(uniqueSizes([])).toEqual([]);
  });

  it("sizesInStock is uniqueSizes without the sold-out ones", () => {
    const sizes = [size("XL"), size("s", false), size("M"), size("m", false)];
    expect(sizesInStock(sizes)).toEqual(
      uniqueSizes(sizes).filter((item) => item.available),
    );
    expect(sizesInStock(sizes)).toEqual([size("M"), size("XL")]);
  });
});

// ---------- per-size quantities (api.md §2.2 `quantity`) ----------
// Test data only: these counts are made up for the tests, not real inventory.

const counted = (
  label: string,
  quantity: number,
  available = true,
): ProductSize => ({ label, available, quantity });

/** XS 15, S 4, M 2, L 1, XL 0: the team lead's example. */
const stockCard: FeedCard = {
  ...base,
  sizes: [
    counted("XS", 15),
    counted("S", 4),
    counted("M", 2),
    counted("L", 1),
    counted("XL", 0, false),
  ],
};

/** The size circles of the visible row: label, availability, badge, screen-reader label. */
function dots(html: string) {
  const list =
    html.match(
      /<ul[^>]*aria-label="Доступні розміри[^"]*"[^>]*>(.*?)<\/ul>/,
    )?.[1] ?? "";
  return [...list.matchAll(/<li([^>]*_dot[^>]*)>(.*?)<\/li>/g)].map(
    ([, attrs = "", inner = ""]) => ({
      label: inner.replace(/<span.*$/, ""),
      available: /data-available="true"/.test(attrs),
      badge: inner.match(/<span[^>]*_badge[^>]*>(\d+)<\/span>/)?.[1] ?? null,
      aria: attrs.match(/aria-label="([^"]*)"/)?.[1] ?? null,
    }),
  );
}

describe("lowStockQuantity: the number on a size's own red badge", () => {
  it.each([
    [5, null],
    [4, 4],
    [3, 3],
    [2, 2],
    [1, 1],
  ])("quantity %i → badge %s", (quantity, badge) => {
    expect(LOW_STOCK_QUANTITY).toBe(4);
    expect(lowStockQuantity(counted("M", quantity))).toBe(badge);
  });

  it("quantity 0 → no badge (the size is sold out)", () => {
    expect(lowStockQuantity(counted("M", 0, false))).toBeNull();
    // even if a source said available with 0 items
    expect(lowStockQuantity(counted("M", 0, true))).toBeNull();
  });

  it("unknown quantity → no badge, available or not; never treated as 0", () => {
    expect(lowStockQuantity(size("M"))).toBeNull();
    expect(lowStockQuantity(size("M", false))).toBeNull();
  });

  it("an unavailable size or a count that is not a whole number → no badge", () => {
    expect(lowStockQuantity(counted("M", 2, false))).toBeNull();
    expect(lowStockQuantity(counted("M", 1.5))).toBeNull();
    expect(lowStockQuantity(counted("M", -1))).toBeNull();
  });
});

describe("uniqueSizes keeps a count only when it is reliable", () => {
  it("keeps the count of a size written once, composites included", () => {
    expect(
      uniqueSizes([counted("M/L", 2), counted("XS/S", 4), size("L")]),
    ).toEqual([size("L"), counted("XS/S", 4), counted("M/L", 2)]);
  });

  it("never adds up or picks the counts of a size written twice", () => {
    const merged = uniqueSizes([counted("XXL", 3), counted("2xl", 1)]);
    expect(merged).toEqual([{ label: "XXL", available: true }]);
    expect(lowStockQuantity(merged[0] ?? size("XXL"))).toBeNull();
  });

  it("a size with 0 items is sold out (grey, struck through), keeping the known 0", () => {
    expect(uniqueSizes([counted("M", 0, true)])).toEqual([
      { label: "M", available: false, quantity: 0 },
    ]);
    expect(sizesInStock([counted("M", 0, true), size("L")])).toEqual([
      size("L"),
    ]);
  });
});

describe("the front side: a red badge on each size with 1–4 items left", () => {
  it("XS 15 · S 4 · M 2 · L 1 · XL 0: three badges at once, XL struck through", () => {
    expect(dots(front(card(stockCard)))).toEqual([
      { label: "XS", available: true, badge: null, aria: null },
      { label: "S", available: true, badge: "4", aria: "S, залишилось 4 шт." },
      { label: "M", available: true, badge: "2", aria: "M, залишилось 2 шт." },
      { label: "L", available: true, badge: "1", aria: "L, залишилось 1 шт." },
      {
        label: "XL",
        available: false,
        badge: null,
        aria: "XL, Немає в наявності",
      },
    ]);
  });

  it("puts each badge inside its own circle, hidden from screen readers", () => {
    const html = front(card(stockCard));
    expect(html).toMatch(
      /<li[^>]*_dot[^>]*aria-label="M, залишилось 2 шт."[^>]*>M<span[^>]*_badge[^>]*aria-hidden="true"[^>]*>2<\/span><\/li>/,
    );
    expect(html).toMatch(/data-badges="true"/);
  });

  it("without counts (every source but One By One): no badges, as before", () => {
    const html = front(card(fewCard));
    expect(dots(html).map((dot) => dot.badge)).toEqual([
      null,
      null,
      null,
      null,
    ]);
    expect(html).toMatch(/data-badges="false"/);
    expect(html).not.toContain("_badge");
  });

  it("keeps sold-out sizes grey and struck through next to badges", () => {
    const html = front(card(stockCard));
    expect(html).toMatch(
      /<li[^>]*data-available="false"[^>]*aria-label="XL, Немає в наявності"[^>]*>XL<\/li>/,
    );
  });

  it("a composite size gets its own badge", () => {
    const html = front(card({ ...base, sizes: [counted("XS/S", 3)] }));
    expect(dots(html)).toEqual([
      {
        label: "XS/S",
        available: true,
        badge: "3",
        aria: "XS/S, залишилось 3 шт.",
      },
    ]);
  });

  it("never brings back the aggregate count", () => {
    const html = front(card(stockCard));
    expect(html).not.toMatch(COUNT);
    expect(circles(html)?.label).toBe("Доступні розміри: XS, S, M, L.");
  });

  it("the catalogue tile shows the same badges on its sizes in stock", () => {
    const html = renderToString(
      <MemoryRouter>
        <CatalogTile card={stockCard} isFavorite={false} index={0} />
      </MemoryRouter>,
    );
    expect(dots(html).map((dot) => [dot.label, dot.badge])).toEqual([
      ["XS", null],
      ["S", "4"],
      ["M", "2"],
      ["L", "1"],
    ]);
  });
});

describe("the back side: the same badges, with a note", () => {
  it("badges and «Залишилось N шт.» for 1–4, «Немає в наявності» for 0, nothing for 15", () => {
    const html = back(card(stockCard));
    expect(html).toMatch(/>XS<\/span><\/li>/);
    for (const [label, count] of [
      ["S", 4],
      ["M", 2],
      ["L", 1],
    ] as const) {
      expect(html).toMatch(
        new RegExp(
          `>${label}<span[^>]*_backSizeBadge[^>]*aria-hidden="true"[^>]*>${count}</span></span><span[^>]*>Залишилось ${count} шт.</span>`,
        ),
      );
    }
    expect(html).toMatch(/>XL<\/span><span[^>]*>Немає в наявності<\/span>/);
    expect(html).not.toMatch(/>XL<span[^>]*_backSizeBadge/);
  });

  it("lists a size written twice once, without a count", () => {
    const html = back(
      card({ ...base, sizes: [counted("XXL", 3), counted("2XL", 1)] }),
    );
    expect(html.match(/_backSizePill/g)).toHaveLength(1);
    expect(html).not.toContain("_backSizeBadge");
    expect(html).not.toContain("Залишилось");
  });
});

describe("badge styles", () => {
  const row = readFileSync("src/shared/ProductCard/SizeRow.module.css", "utf8");
  const cardCss = readFileSync(
    "src/shared/ProductCard/ProductCard.module.css",
    "utf8",
  );

  it("anchors the badge to its own circle with the existing tokens", () => {
    expect(row).toMatch(/\.dot\s*{\s*position: relative;/);
    const badge = row.match(/\.badge\s*{([^}]*)}/)?.[1] ?? "";
    expect(badge).toContain("position: absolute;");
    expect(badge).toContain("background-color: var(--color-danger);");
    expect(badge).toContain("min-width: var(--size-count-badge);");
    expect(cardCss).toMatch(/\.backSizePill\s*{\s*position: relative;/);
  });

  it("widens the gap past the badge's overhang, so no badge covers a neighbour", () => {
    // overhang = badge / 3 = 6px; the gap with badges is --space-1 = 8px
    expect(row).toMatch(
      /\.row\[data-badges="true"\] \.list,\s*\.row\[data-badges="true"\] \.measure\s*{\s*gap: var\(--space-1\);/,
    );
    expect(cardCss).toMatch(
      /\.backSizes\[data-badges="true"\] \.backSize\s*{\s*gap: var\(--space-1\);/,
    );
    expect(row).toMatch(/top: calc\(var\(--size-count-badge\) \/ -3\);/);
  });
});
