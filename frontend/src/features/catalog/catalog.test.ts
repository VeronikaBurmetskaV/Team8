import { describe, expect, it } from "vitest";
import {
  applyPriceFilter,
  visibleBrands,
  formatThousands,
  priceApplyLabel,
  samePriceRange,
  brandHref,
  brandKey,
  isSingleBrandView,
  brandOptions,
  countActiveFilters,
  filterCatalog,
  filterChips,
  NO_FILTERS,
  parseFilters,
  withBrandToggled,
  withoutFilter,
  withoutFilters,
  CATALOG_PAGE_SIZE,
  committedRange,
  filterByPriceRange,
  filterPanelReducer,
  formatPriceRange,
  hasMore,
  initialPriceDraft,
  nearestThumb,
  nextVisibleCount,
  NO_PRICE_RANGE,
  parsePriceRange,
  PRICE_MAX,
  PRICE_MIN,
  PRICE_STEP,
  priceAtPointer,
  priceDraftReducer,
  pricePercent,
  thumbValueForKey,
  withPriceRange,
  type PriceDraft,
  type PriceDraftAction,
} from "./catalog";
import {
  addToFavorites,
  createFavoriteList,
  FAVORITES_STORAGE_KEY,
  toggleFavorite,
  type SavedProduct,
} from "../../shared/productLists";
import { memoryStorage } from "../../shared/testStorage";

describe("«Показати ще»", () => {
  it("shows 24 first, then 24 more, then the rest, then nothing more", () => {
    const total = 60;
    let visible = Math.min(CATALOG_PAGE_SIZE, total);
    expect(visible).toBe(24);
    expect(hasMore(visible, total)).toBe(true);

    visible = nextVisibleCount(visible, total);
    expect(visible).toBe(48);
    expect(hasMore(visible, total)).toBe(true);

    visible = nextVisibleCount(visible, total);
    expect(visible).toBe(60);
    expect(hasMore(visible, total)).toBe(false);

    expect(nextVisibleCount(visible, total)).toBe(60);
  });

  it("has nothing more when the catalogue fits on the first page", () => {
    expect(hasMore(10, 10)).toBe(false);
    expect(hasMore(24, 24)).toBe(false);
    expect(hasMore(0, 0)).toBe(false);
  });
});

describe("filter panel", () => {
  it("«Фільтри» opens and closes it", () => {
    const opened = filterPanelReducer(false, { type: "toggle" });
    expect(opened).toBe(true);
    expect(filterPanelReducer(opened, { type: "toggle" })).toBe(false);
  });

  it("the ✕ button and a click on the backdrop close it", () => {
    expect(filterPanelReducer(true, { type: "close" })).toBe(false);
    expect(filterPanelReducer(false, { type: "close" })).toBe(false);
  });

  it("Escape closes it, other keys do not", () => {
    expect(filterPanelReducer(true, { type: "key", key: "Escape" })).toBe(
      false,
    );
    expect(filterPanelReducer(true, { type: "key", key: "Tab" })).toBe(true);
    expect(filterPanelReducer(true, { type: "key", key: "Enter" })).toBe(true);
  });
});

describe("heart on a tile", () => {
  const product: SavedProduct = {
    id: "p1",
    name: "Лляна сукня",
    brandName: "Бренд",
    priceUah: 2400,
    photoUrl: "https://img.example/p1.jpg",
    productUrl: "https://brand.example/p1",
  };

  it("adds to the one «Вподобане»", () => {
    const storage = memoryStorage();
    const list = createFavoriteList(() => storage);

    expect(toggleFavorite(product, list)).toBe("added");
    expect(list.has("p1")).toBe(true);
    expect(storage.getItem(FAVORITES_STORAGE_KEY)).toContain('"p1"');
  });

  it("a product already liked in the swipe feed is not added twice", () => {
    const storage = memoryStorage();
    const list = createFavoriteList(() => storage);
    addToFavorites(product, list); // swipe right in /feed
    // The tile shows a filled heart, so this click removes rather than duplicates.
    expect(toggleFavorite(product, list)).toBe("removed");
    toggleFavorite(product, list);
    addToFavorites(product, list);
    expect(list.read()).toHaveLength(1);
  });

  it("a second click removes it again", () => {
    const storage = memoryStorage();
    const list = createFavoriteList(() => storage);
    toggleFavorite(product, list);

    expect(toggleFavorite(product, list)).toBe("removed");
    expect(list.has("p1")).toBe(false);
  });
});

describe("price range filter", () => {
  const items = [
    { id: "a", priceUah: 400 },
    { id: "b", priceUah: 500 },
    { id: "c", priceUah: 2500 },
    { id: "d", priceUah: 2600 },
    { id: "e", priceUah: 15000 },
  ];
  const ids = (list: readonly { id: string }[]) => list.map((item) => item.id);
  const url = (query: string) => parsePriceRange(new URLSearchParams(query));

  it("range is 0–10000 with a step of 100", () => {
    expect([PRICE_MIN, PRICE_MAX, PRICE_STEP]).toEqual([0, 10000, 100]);
  });

  it("keeps A <= price <= B, both ends included", () => {
    expect(ids(filterByPriceRange(items, { min: 500, max: 2500 }))).toEqual([
      "b",
      "c",
    ]);
  });

  it("only min: everything from A up, including above 10000", () => {
    expect(ids(filterByPriceRange(items, { min: 2500, max: null }))).toEqual([
      "c",
      "d",
      "e",
    ]);
  });

  it("only max: everything up to B", () => {
    expect(ids(filterByPriceRange(items, { min: null, max: 500 }))).toEqual([
      "a",
      "b",
    ]);
  });

  it("without a range, shows everything", () => {
    expect(filterByPriceRange(items, NO_PRICE_RANGE)).toBe(items);
  });

  it("reads a valid range from the URL", () => {
    expect(url("minPrice=500&maxPrice=2500")).toEqual({ min: 500, max: 2500 });
    expect(url("minPrice=500")).toEqual({ min: 500, max: null });
    expect(url("maxPrice=2500")).toEqual({ min: null, max: 2500 });
  });

  it("the edges mean «no limit»: minPrice=0, maxPrice=10000", () => {
    expect(url("minPrice=0&maxPrice=10000")).toEqual(NO_PRICE_RANGE);
  });

  it("ignores invalid URL parameters", () => {
    for (const bad of ["abc", "-100", "10001", "2.5e3", "12px", "", "NaN"]) {
      expect(url(`minPrice=${bad}`)).toEqual(NO_PRICE_RANGE);
      expect(url(`maxPrice=${bad}`)).toEqual(NO_PRICE_RANGE);
    }
    // One bad side does not drop the good one.
    expect(url("minPrice=abc&maxPrice=2500")).toEqual({ min: null, max: 2500 });
    // min above max: both ignored.
    expect(url("minPrice=3000&maxPrice=1000")).toEqual(NO_PRICE_RANGE);
  });

  it("applying writes only the sides away from the edges and closes the drawer", () => {
    const base = new URLSearchParams("utm=x");
    const both = applyPriceFilter(base, { min: 500, max: 2500 }, true);
    expect(both.params.toString()).toBe("utm=x&minPrice=500&maxPrice=2500");
    expect(both.panelOpen).toBe(false);

    expect(
      applyPriceFilter(base, { min: null, max: 2500 }, true).params.toString(),
    ).toBe("utm=x&maxPrice=2500");
    expect(
      applyPriceFilter(base, { min: 500, max: null }, true).params.toString(),
    ).toBe("utm=x&minPrice=500");
    expect(base.toString()).toBe("utm=x");
  });

  it("applying with both thumbs on the edges resets the filter", () => {
    const params = new URLSearchParams("minPrice=500&maxPrice=2500");
    const draft = initialPriceDraft(NO_PRICE_RANGE);
    const applied = applyPriceFilter(params, committedRange(draft), true);
    expect(applied.params.toString()).toBe("");
    expect(withPriceRange(params, NO_PRICE_RANGE).toString()).toBe("");
  });

  it("on a laptop the filter column stays open after applying", () => {
    expect(
      applyPriceFilter(new URLSearchParams(), { min: 500, max: null }, false)
        .panelOpen,
    ).toBe(true);
  });

  it("chip labels: range, only from, only to", () => {
    expect(formatPriceRange({ min: 500, max: 2500 })).toBe("500 – 2500 грн");
    expect(formatPriceRange({ min: 500, max: null })).toBe("від 500 грн");
    expect(formatPriceRange({ min: null, max: 2500 })).toBe("до 2500 грн");
  });
});

describe("price fields and two-thumb slider", () => {
  const run = (actions: PriceDraftAction[], from: PriceDraft) =>
    actions.reduce(priceDraftReducer, from);
  const start = initialPriceDraft(NO_PRICE_RANGE);
  /** The fields split thousands with a no-break space. */
  const nb = (text: string) => text.replace(/ /g, "\u00a0");

  it("starts with the thumbs on the edges, or on the applied range", () => {
    expect(start).toEqual({
      min: 0,
      max: 10000,
      minText: "0",
      maxText: nb("10 000"),
    });
    expect(initialPriceDraft({ min: 500, max: null })).toMatchObject({
      min: 500,
      max: 10000,
    });
  });

  it("moving a thumb writes the number into its field", () => {
    const draft = run([{ type: "slide", thumb: "min", value: 1200 }], start);
    expect(draft).toMatchObject({ min: 1200, minText: nb("1 200") });
  });

  it("typing moves the thumb only on blur / Enter (commit)", () => {
    const typing = run([{ type: "type", thumb: "max", text: "25" }], start);
    expect(typing).toMatchObject({ max: 10000, maxText: "25" });
    const done = run(
      [
        { type: "type", thumb: "max", text: "2500" },
        { type: "commit", thumb: "max" },
      ],
      start,
    );
    expect(done).toMatchObject({ max: 2500, maxText: nb("2 500") });
  });

  it("a field takes digits only (a formatted value can be edited)", () => {
    const typed = run(
      [{ type: "type", thumb: "max", text: nb("12 5x0") }],
      start,
    );
    expect(typed.maxText).toBe("1250");
  });

  it("invalid input goes to the nearest edge", () => {
    const commit = (thumb: "min" | "max", text: string) =>
      run(
        [
          { type: "type", thumb, text },
          { type: "commit", thumb },
        ],
        start,
      );
    // The minus never gets in: «-300» is typed as «300».
    expect(commit("min", "-300")).toMatchObject({ min: 300, minText: "300" });
    expect(commit("max", "25000")).toMatchObject({
      max: 10000,
      maxText: nb("10 000"),
    });
    expect(commit("min", "abc")).toMatchObject({ min: 0, minText: "0" });
    expect(commit("max", "")).toMatchObject({ max: 10000 });
    expect(commit("min", "1 500")).toMatchObject({ min: 1500 });
  });

  it("the thumbs never cross: at least one step between them", () => {
    const range = initialPriceDraft({ min: 2000, max: 3000 });
    expect(
      run([{ type: "slide", thumb: "min", value: 5000 }], range),
    ).toMatchObject({ min: 2900, max: 3000 });
    expect(
      run([{ type: "slide", thumb: "max", value: 0 }], range),
    ).toMatchObject({ min: 2000, max: 2100 });
    // A typed «від» above «до» is pulled back too.
    expect(
      run(
        [
          { type: "type", thumb: "min", text: "8000" },
          { type: "commit", thumb: "min" },
        ],
        range,
      ),
    ).toMatchObject({ min: 2900, minText: nb("2 900") });
  });

  it("the apply button uses a field still being typed in", () => {
    const draft = run([{ type: "type", thumb: "min", text: "700" }], start);
    expect(committedRange(draft)).toEqual({ min: 700, max: null });
  });

  it("keys: arrows ±100, PageUp/PageDown ±1000, Home/End the edges", () => {
    expect(thumbValueForKey(500, "ArrowRight")).toBe(600);
    expect(thumbValueForKey(500, "ArrowUp")).toBe(600);
    expect(thumbValueForKey(500, "ArrowLeft")).toBe(400);
    expect(thumbValueForKey(500, "ArrowDown")).toBe(400);
    expect(thumbValueForKey(500, "PageUp")).toBe(1500);
    expect(thumbValueForKey(5000, "PageDown")).toBe(4000);
    expect(thumbValueForKey(500, "Home")).toBe(0);
    expect(thumbValueForKey(500, "End")).toBe(10000);
    expect(thumbValueForKey(500, "Tab")).toBeNull();
    // Out of range goes back in through the reducer.
    expect(run([{ type: "slide", thumb: "min", value: -900 }], start).min).toBe(
      0,
    );
  });

  it("edges sit exactly on the line ends: 0 % and 100 %", () => {
    expect(pricePercent(PRICE_MIN)).toBe(0);
    expect(pricePercent(PRICE_MAX)).toBe(100);
    expect(pricePercent(2500)).toBe(25);
  });

  it("a pointer on the line gives a value snapped to the step", () => {
    expect(priceAtPointer(10, 10, 200)).toBe(0);
    expect(priceAtPointer(210, 10, 200)).toBe(10000);
    expect(priceAtPointer(61, 10, 200)).toBe(2600);
    expect(priceAtPointer(-50, 10, 200)).toBe(0);
    expect(priceAtPointer(500, 10, 200)).toBe(10000);
  });

  it("a press on the line moves the nearer thumb", () => {
    const thumbs = { min: 2000, max: 6000 };
    expect(nearestThumb(thumbs, 1000)).toBe("min");
    expect(nearestThumb(thumbs, 3000)).toBe("min");
    expect(nearestThumb(thumbs, 5000)).toBe("max");
    expect(nearestThumb(thumbs, 9000)).toBe("max");
  });
});

describe("brand options", () => {
  const item = (brandName: string) => ({ brandName });

  it("one brand per name, ignoring case and extra spaces; the most frequent spelling", () => {
    const options = brandOptions([
      item("CHER'17"),
      item("Cher'17"),
      item(" Cher'17 "),
      item("cher'17"),
    ]);
    expect(options).toEqual([{ key: "cher'17", label: "Cher'17", count: 4 }]);
  });

  it("a tie keeps the first spelling seen", () => {
    expect(brandOptions([item("GUNIA"), item("Gunia")])[0]?.label).toBe(
      "GUNIA",
    );
  });

  // The "uk" collation puts the Ukrainian alphabet first, Latin names after it.
  it("sorted by name (Ukrainian alphabet), with product counts", () => {
    const options = brandOptions([
      item("Яблуко"),
      item("Barricade"),
      item("Єва"),
      item("Barricade"),
      item("Іскра"),
      item("Але"),
      item("   "),
    ]);
    expect(options.map((o) => `${o.label} ${o.count}`)).toEqual([
      "Але 1",
      "Єва 1",
      "Іскра 1",
      "Яблуко 1",
      "Barricade 2",
    ]);
  });
});

describe("all filters together", () => {
  const items = [
    { id: "a", brandName: "Barricade", priceUah: 900 },
    { id: "b", brandName: "barricade ", priceUah: 3000 },
    { id: "c", brandName: "Gunia", priceUah: 1500 },
    { id: "d", brandName: "Cher'17", priceUah: 2000 },
  ];
  const ids = (list: readonly { id: string }[]) => list.map((item) => item.id);

  it("without filters, everything", () => {
    expect(filterCatalog(items, NO_FILTERS)).toBe(items);
  });

  it("one brand", () => {
    expect(
      ids(
        filterCatalog(items, {
          ...NO_FILTERS,
          brands: ["barricade"],
          sizes: [],
        }),
      ),
    ).toEqual(["a", "b"]);
  });

  it("several brands: OR", () => {
    expect(
      ids(
        filterCatalog(items, {
          ...NO_FILTERS,
          brands: ["gunia", "cher'17"],
          sizes: [],
        }),
      ),
    ).toEqual(["c", "d"]);
  });

  it("brand AND price", () => {
    expect(
      ids(
        filterCatalog(items, {
          minPrice: null,
          maxPrice: 2000,
          brands: ["barricade", "cher'17"],
          sizes: [],
        }),
      ),
    ).toEqual(["a", "d"]);
  });

  it("parseFilters: repeated ?brand, normalized, no repeats", () => {
    const params = new URLSearchParams(
      "brand=gunia&brand=Barricade&brand=gunia&minPrice=500",
    );
    expect(parseFilters(params)).toEqual({
      minPrice: 500,
      maxPrice: null,
      brands: ["gunia", "barricade"],
      sizes: [],
    });
  });

  it("parseFilters: unknown brands and invalid prices are ignored", () => {
    const known = new Set(["gunia", "barricade"]);
    const params = new URLSearchParams(
      "brand=nobody&brand=gunia&maxPrice=abc&minPrice=-5",
    );
    expect(parseFilters(params, known)).toEqual({
      minPrice: null,
      maxPrice: null,
      brands: ["gunia"],
      sizes: [],
    });
  });

  it("a brand click adds it to the URL; a second click removes it", () => {
    const added = withBrandToggled(
      new URLSearchParams("maxPrice=2000"),
      "gunia",
    );
    expect(added.toString()).toBe("maxPrice=2000&brand=gunia");
    const two = withBrandToggled(added, "cher'17");
    expect(two.getAll("brand")).toEqual(["gunia", "cher'17"]);
    const removed = withBrandToggled(two, "gunia");
    expect(removed.getAll("brand")).toEqual(["cher'17"]);
    expect(removed.get("maxPrice")).toBe("2000");
  });

  it("a chip's ✕ removes only its own filter", () => {
    const params = new URLSearchParams(
      "brand=gunia&brand=barricade&minPrice=500&maxPrice=2000",
    );
    const noGunia = withoutFilter(params, "brand:gunia");
    expect(noGunia.getAll("brand")).toEqual(["barricade"]);
    expect(noGunia.get("minPrice")).toBe("500");
    const noPrice = withoutFilter(params, "price");
    expect(noPrice.getAll("brand")).toEqual(["gunia", "barricade"]);
    expect(noPrice.has("minPrice") || noPrice.has("maxPrice")).toBe(false);
  });

  it("«Скинути все» removes every filter and keeps other parameters", () => {
    const params = new URLSearchParams(
      "utm=x&brand=gunia&minPrice=500&maxPrice=2000",
    );
    expect(withoutFilters(params).toString()).toBe("utm=x");
  });

  it("chips: one per brand (its label), then the price; badge counts them", () => {
    const filters = {
      minPrice: 500,
      maxPrice: 2500,
      brands: ["gunia", "barricade"],
      sizes: [],
    };
    const options = brandOptions(items);
    expect(filterChips(filters, options)).toEqual([
      {
        id: "brand:gunia",
        label: "Gunia",
        removeLabel: "Скинути фільтр: бренд Gunia",
      },
      {
        id: "brand:barricade",
        label: "Barricade",
        removeLabel: "Скинути фільтр: бренд Barricade",
      },
      {
        id: "price",
        label: "Ціна: 500 – 2500 грн",
        removeLabel: "Скинути фільтр: ціна 500 – 2500 грн",
      },
    ]);
    expect(countActiveFilters(filters)).toBe(3);
    expect(
      countActiveFilters({ ...NO_FILTERS, brands: ["gunia"], sizes: [] }),
    ).toBe(1);
    expect(countActiveFilters(NO_FILTERS)).toBe(0);
  });
});

describe("brand link and brand page", () => {
  it("brandKey: every apostrophe gives one key («CHER'17»)", () => {
    const key = brandKey("CHER'17");
    expect(key).toBe("cher'17");
    for (const spelling of [
      "CHER’17",
      "cher'17 ",
      "Cher‘17",
      "CHERʼ17",
      "CHER`17",
      "CHER´17",
      "CHER＇17",
      "\u200BCHER'17",
    ]) {
      expect(brandKey(spelling)).toBe(key);
    }
  });

  it("brandKey: every kind of space gives one key («One By One»)", () => {
    const key = brandKey("One By One");
    expect(key).toBe("one by one");
    for (const spelling of [
      "One\u00A0By One",
      "ONE BY ONE",
      " one  by\tone ",
      "One\u2009By\u202FOne",
      "Ｏｎｅ Ｂｙ Ｏｎｅ",
    ]) {
      expect(brandKey(spelling)).toBe(key);
    }
  });

  it("brandKey lower-cases Ukrainian names and keeps different brands apart", () => {
    expect(brandKey("ЇЖАК Студія")).toBe("їжак студія");
    expect(brandKey("SIL'")).not.toBe(brandKey("SIL"));
    expect(brandKey("One By One")).not.toBe(brandKey("OneByOne"));
  });

  it("the ?brand= link survives the URL both ways (URLSearchParams only)", () => {
    for (const name of ["CHER’17", "One\u00A0By One", "J. Cook & Co+"]) {
      const href = brandHref(name);
      const back = new URL(href, "http://fulla.local").searchParams;
      expect(parseFilters(back).brands).toEqual([brandKey(name)]);
    }
    expect(brandHref("CHER’17")).toBe("/?brand=cher%2717");
    expect(brandHref("One\u00A0By One")).toBe("/?brand=one+by+one");
  });

  it("brandOptions merges spellings and labels the brand by the commonest one", () => {
    expect(
      brandOptions([
        { brandName: "CHER'17" },
        { brandName: "CHER’17" },
        { brandName: "CHER'17 " },
        { brandName: "One\u00A0By One" },
        { brandName: "One By One" },
        { brandName: "One By One" },
      ]),
    ).toEqual([
      { key: "cher'17", label: "CHER'17", count: 3 },
      { key: "one by one", label: "One By One", count: 3 },
    ]);
  });

  it("brandKey is the same for any case and extra spaces", () => {
    expect(brandKey("MINT")).toBe("mint");
    expect(brandKey("  Mint ")).toBe("mint");
    expect(brandKey("Cher'17")).toBe(brandKey(" CHER'17"));
    expect(brandKey("Lilo   Brand")).toBe("lilo brand");
  });

  it("brandOptions uses the same key", () => {
    expect(brandOptions([{ brandName: " MINT " }])[0]?.key).toBe(
      brandKey("Mint"),
    );
  });

  it("brandHref is exactly /?brand=<key>", () => {
    expect(brandHref(" MINT ")).toBe("/?brand=mint");
    expect(brandHref("Lilo Brand")).toBe("/?brand=lilo+brand");
  });

  it("a brand page is exactly one brand and no other filter", () => {
    expect(
      isSingleBrandView({ ...NO_FILTERS, brands: ["mint"], sizes: [] }),
    ).toBe(true);
    expect(isSingleBrandView(NO_FILTERS)).toBe(false);
    expect(
      isSingleBrandView({
        ...NO_FILTERS,
        brands: ["mint", "gunia"],
        sizes: [],
      }),
    ).toBe(false);
    expect(
      isSingleBrandView({
        minPrice: null,
        maxPrice: 2000,
        brands: ["mint"],
        sizes: [],
      }),
    ).toBe(false);
    expect(
      isSingleBrandView({
        minPrice: 500,
        maxPrice: null,
        brands: ["mint"],
        sizes: [],
      }),
    ).toBe(false);
  });
});

describe("price apply button text", () => {
  const plain = (text: string) => text.replace(/\u00a0/g, " ");

  it("thousands split by a no-break space", () => {
    expect(plain(formatThousands(10000))).toBe("10 000");
    expect(formatThousands(10000)).toBe("10\u00a0000");
    expect(formatThousands(500)).toBe("500");
    expect(formatThousands(0)).toBe("0");
  });

  it("names the range it applies: 4 variants", () => {
    expect(plain(priceApplyLabel({ min: 500, max: 2500 }))).toBe(
      "Показати від 500 до 2 500 грн",
    );
    expect(plain(priceApplyLabel({ min: null, max: 2500 }))).toBe(
      "Показати до 2 500 грн",
    );
    expect(plain(priceApplyLabel({ min: 500, max: null }))).toBe(
      "Показати від 500 грн",
    );
    expect(priceApplyLabel(NO_PRICE_RANGE)).toBe("Показати всі ціни");
  });

  it("compares ranges for the disabled state", () => {
    expect(
      samePriceRange({ min: 500, max: null }, { min: 500, max: null }),
    ).toBe(true);
    expect(samePriceRange({ min: 500, max: null }, NO_PRICE_RANGE)).toBe(false);
  });
});

describe("visible brands", () => {
  const options = brandOptions(
    Array.from({ length: 10 }, (_, i) => ({ brandName: `Brand ${i}` })),
  );
  const keys = (list: readonly { key: string }[]) => list.map((o) => o.key);

  it("collapsed: the first 8 plus chosen ones, in catalogue order", () => {
    expect(
      visibleBrands(options, [], { expanded: false, query: "" }),
    ).toHaveLength(8);
    expect(
      keys(visibleBrands(options, ["brand 9"], { expanded: false, query: "" })),
    ).toEqual([...keys(options.slice(0, 8)), "brand 9"]);
  });

  it("expanded: all of them", () => {
    expect(visibleBrands(options, [], { expanded: true, query: "" })).toBe(
      options,
    );
  });

  it("a query searches every brand, ignoring case and spaces", () => {
    expect(
      keys(
        visibleBrands(options, [], { expanded: false, query: " BRAND  9 " }),
      ),
    ).toEqual(["brand 9"]);
    expect(visibleBrands(options, [], { expanded: true, query: "x" })).toEqual(
      [],
    );
  });
});
