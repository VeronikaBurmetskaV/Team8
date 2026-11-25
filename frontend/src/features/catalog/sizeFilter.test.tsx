import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { withFilterParams } from "../../shared/filterLinks";
import {
  countActiveFilters,
  filterCatalog,
  filterChips,
  filtersKey,
  isSingleBrandView,
  NO_FILTERS,
  parseFilters,
  sizeKey,
  sizeOptions,
  withoutFilter,
  withoutFilters,
  withSelectedSizes,
  withSizeToggled,
} from "./catalog";
import { FilterPanel } from "./FilterPanel";
import { withFilters } from "./filterState";
import { SizeFilter } from "./SizeFilter";

type AnyProps = Record<string, unknown> & { children?: ReactNode };
function elements(node: ReactNode): ReactElement<AnyProps>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<AnyProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}

const size = (label: string, available = true) => ({ label, available });
const card = (
  id: string,
  sizes?: { label: string; available: boolean }[],
  brandName = "Mint",
  priceUah = 1000,
) => ({ id, brandName, priceUah, sizes });

describe("sizeKey", () => {
  it("trims, upper-cases letter sizes and unifies 2XL = XXL", () => {
    expect(sizeKey(" m ")).toBe("M");
    expect(sizeKey("xl")).toBe("XL");
    expect(sizeKey("2xl")).toBe("XXL");
    expect(sizeKey("XXXL")).toBe("3XL");
    expect(sizeKey("42")).toBe("42");
  });

  it("keeps a composite as one size, without spaces around «/»", () => {
    expect(sizeKey(" xs / s ")).toBe("XS/S");
    expect(sizeKey("S/M")).toBe("S/M");
  });

  it.each([
    "one size",
    "Onesize",
    "ONE-SIZE",
    "universal",
    "Універсальний",
    "єдиний",
  ])("%j → «One size»", (label) => {
    expect(sizeKey(label)).toBe("One size");
  });
});

describe("sizeOptions", () => {
  const items = [
    card("a", [size("m"), size("XS"), size("42"), size("one size")]),
    card("b", [size("M"), size("2XL"), size("XS/S"), size("26")]),
    card("c", [
      size("S/M"),
      size("xxl"),
      size("3XL"),
      size("44"),
      size("L", false),
    ]),
    card("d"), // a brand card: no sizes
  ];

  it("takes only sizes in stock and counts the products that have each", () => {
    const options = sizeOptions(items);
    expect(options.find((o) => o.key === "M")?.count).toBe(2);
    expect(options.find((o) => o.key === "XXL")?.count).toBe(2);
    expect(options.some((o) => o.key === "L")).toBe(false);
  });

  it("orders letters, then composites, then numbers, «One size» last", () => {
    expect(sizeOptions(items).map((o) => o.key)).toEqual([
      "XS",
      "M",
      "XXL",
      "3XL",
      "XS/S",
      "S/M",
      "26",
      "42",
      "44",
      "One size",
    ]);
  });

  it("keeps a chosen size with nothing left at 0, so it can be unticked", () => {
    const options = withSelectedSizes(sizeOptions(items), ["L"]);
    expect(options.find((o) => o.key === "L")).toEqual({
      key: "L",
      label: "L",
      count: 0,
    });
  });
});

describe("filtering by size", () => {
  const items = [
    card("m", [size("M")]),
    card("xs", [size("xs")]),
    card("m-out", [size("M", false)]),
    card("brand-card"),
    card("gunia-m", [size("M")], "Gunia", 3000),
  ];
  const ids = (list: readonly { id: string }[]) => list.map((item) => item.id);

  it("keeps cards with any chosen size in stock (OR); cards without sizes never pass", () => {
    expect(ids(filterCatalog(items, { ...NO_FILTERS, sizes: ["M"] }))).toEqual([
      "m",
      "gunia-m",
    ]);
    expect(
      ids(filterCatalog(items, { ...NO_FILTERS, sizes: ["M", "XS"] })),
    ).toEqual(["m", "xs", "gunia-m"]);
  });

  it("combines with the brand and the price (AND)", () => {
    expect(
      ids(
        filterCatalog(items, {
          ...NO_FILTERS,
          sizes: ["M"],
          brands: ["gunia"],
        }),
      ),
    ).toEqual(["gunia-m"]);
    expect(
      ids(
        filterCatalog(items, { ...NO_FILTERS, sizes: ["M"], maxPrice: 2000 }),
      ),
    ).toEqual(["m"]);
  });
});

describe("?size= in the URL", () => {
  it("ignores sizes that no card of the catalogue has", () => {
    const params = new URLSearchParams("size=M&size=ZZZ&size=xs");
    expect(parseFilters(params, null, new Set(["M", "XS"])).sizes).toEqual([
      "M",
      "XS",
    ]);
    // while the catalogue is loading, every size is kept
    expect(parseFilters(params).sizes).toEqual(["M", "ZZZ", "XS"]);
  });

  it("a click adds the size, a second click removes it", () => {
    let params = withSizeToggled(new URLSearchParams("brand=mint"), "m");
    expect(params.toString()).toBe("brand=mint&size=M");
    params = withSizeToggled(params, "XS/S");
    expect(params.getAll("size")).toEqual(["M", "XS/S"]);
    expect(withSizeToggled(params, "M").getAll("size")).toEqual(["XS/S"]);
  });

  it("is read back normalized, once each, and survives a reload", () => {
    const filters = parseFilters(
      new URLSearchParams("size=m&size=M&size=one%20size"),
    );
    expect(filters.sizes).toEqual(["M", "One size"]);
    const href = withFilters("/", filters);
    expect(parseFilters(new URL(href, "http://x").searchParams).sizes).toEqual([
      "M",
      "One size",
    ]);
  });

  it("travels between / and /feed with the other filters", () => {
    expect(withFilterParams("/feed", "?size=M&maxPrice=2000&utm=x")).toBe(
      "/feed?size=M&maxPrice=2000",
    );
  });

  it("counts on «Фільтри», gets a chip, and «Скинути все» removes it", () => {
    const filters = { ...NO_FILTERS, sizes: ["M", "XS/S"] };
    expect(countActiveFilters(filters)).toBe(2);
    expect(filtersKey(filters)).not.toBe(filtersKey(NO_FILTERS));
    const chips = filterChips(filters, []);
    expect(
      chips.map((chip) => [chip.id, chip.label, chip.removeLabel]),
    ).toEqual([
      ["size:M", "Розмір M", "Скинути фільтр: розмір M"],
      ["size:XS/S", "Розмір XS/S", "Скинути фільтр: розмір XS/S"],
    ]);
    const params = new URLSearchParams("size=M&size=XS%2FS&brand=mint");
    expect(withoutFilter(params, "size:M").getAll("size")).toEqual(["XS/S"]);
    expect(withoutFilters(params).toString()).toBe("");
  });

  it("a brand page with a size is the ordinary catalogue", () => {
    expect(
      isSingleBrandView({ ...NO_FILTERS, brands: ["mint"], sizes: ["M"] }),
    ).toBe(false);
  });
});

describe("the «Розмір» group", () => {
  const options = [
    { key: "M", label: "M", count: 5 },
    { key: "One size", label: "One size", count: 1 },
  ];

  it("renders a toggle per size with aria-pressed and «Розмір M, 5 товарів»", () => {
    const markup = renderToString(
      <SizeFilter
        id="f-size"
        options={options}
        selected={["M"]}
        onToggle={() => {}}
      />,
    );
    const button = (label: string) =>
      markup.match(
        new RegExp(`<button[^>]*aria-label="Розмір ${label}[^"]*"[^>]*>`),
      )?.[0] ?? "";
    expect(button("M")).toContain('aria-pressed="true"');
    expect(button("M")).toContain('aria-label="Розмір M, 5 товарів"');
    expect(button("One size")).toContain('aria-pressed="false"');
    expect(markup).toContain(">One size</button>");
  });

  it("a click toggles that size, inside a fieldset named «Розмір»", () => {
    const onToggle = vi.fn();
    const tree = SizeFilter({ id: "f-size", options, selected: [], onToggle });
    const all = elements(tree);
    expect(all[0]?.type).toBe("fieldset");
    expect(all.find((e) => e.type === "legend")?.props.children).toBe("Розмір");
    const buttons = all.filter((e) => e.type === "button");
    (buttons[1]?.props.onClick as () => void)();
    expect(onToggle).toHaveBeenCalledWith("One size");
  });

  it("is open with «Розмір · 2» when sizes are chosen, and no longer «Скоро»", () => {
    const markup = renderToString(
      <FilterPanel
        id="f"
        isDrawer={false}
        onClose={() => {}}
        appliedPrice={{ min: null, max: null }}
        onApplyPrice={() => {}}
        onResetPrice={() => {}}
        brandOptions={[]}
        selectedBrands={[]}
        onToggleBrand={() => {}}
        sizeOptions={options}
        selectedSizes={["M", "One size"]}
        onToggleSize={() => {}}
        activeCount={2}
        onResetAll={() => {}}
        resultCount={3}
        announcement={null}
      />,
    );
    expect(markup).toMatch(/Розмір<span[^>]*>· 2<\/span>/);
    expect(markup).toMatch(/id="f-size-button"[^>]*aria-expanded="true"/);
    expect(markup).toContain('aria-label="Розмір M, 5 товарів"');
  });
});

describe("«Фільтри» button look (CatalogPage.module.css)", () => {
  // Vitest does not load CSS: the rules are read as text, from the file the app uses.
  const css = readFileSync(
    "src/features/catalog/CatalogPage.module.css",
    "utf8",
  );
  const rule = (selector: string) => {
    const start = css.indexOf(`${selector} {`);
    return start < 0 ? "" : css.slice(start, css.indexOf("}", start));
  };

  it("is black by default, with a short colour transition", () => {
    const base = rule(".filtersButton");
    expect(base).toContain("background-color: var(--color-black)");
    expect(base).toContain("transition:");
  });

  it("turns green on hover and on keyboard focus", () => {
    const hover = rule(
      '.filtersButton:hover:not(:disabled),\n.filtersButton:focus-visible,\n.filtersButton[aria-expanded="true"]',
    );
    expect(hover).toContain("background-color: var(--color-green)");
  });

  it("group titles and «+/−» turn green on hover", () => {
    expect(rule(".groupToggle:hover:not(:disabled)")).toContain(
      "color: var(--color-green)",
    );
    expect(rule(".groupToggle:hover:not(:disabled) .groupIcon")).toContain(
      "color: var(--color-green)",
    );
  });
});
