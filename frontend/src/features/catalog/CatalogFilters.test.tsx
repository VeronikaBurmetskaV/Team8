import { describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import type { FeedCard } from "../../api/types";
import { BrandFilterView } from "./BrandFilter";
import { CatalogResults } from "./CatalogPage";
import { FilterGroupView } from "./FilterGroup";
import { FilterChips } from "./FilterChips";
import { FilterPanel } from "./FilterPanel";
import { PriceFilterView } from "./PriceFilter";
import {
  brandOptions,
  filterChips,
  initialPriceDraft,
  NO_FILTERS,
  NO_PRICE_RANGE,
  type BrandOption,
  type CatalogFilters,
  type SizeOption,
  type PriceDraft,
  type PriceRange,
} from "./catalog";

type AnyProps = Record<string, unknown> & { children?: ReactNode };

/** Hook-free components whose output the tests look into (called as plain functions). */
const HOOK_FREE = new Set<unknown>([FilterChips]);

/** All elements of a tree returned by a hook-free component, depth first. */
function elements(node: ReactNode): ReactElement<AnyProps>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<AnyProps>(node)) return [];
  if (HOOK_FREE.has(node.type)) {
    const render = node.type as (props: AnyProps) => ReactNode;
    return [node, ...elements(render(node.props))];
  }
  return [node, ...elements(node.props.children)];
}

/** Text of an element's children (strings and numbers only). */
function text(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (isValidElement<AnyProps>(node)) return text(node.props.children);
  return "";
}

function buttonByText(tree: ReactNode, label: string) {
  const found = elements(tree).find(
    (element) => element.type === "button" && text(element) === label,
  );
  if (!found) throw new Error(`no button «${label}»`);
  return found;
}

function byId(tree: ReactNode, id: string) {
  const found = elements(tree).find((element) => element.props.id === id);
  if (!found) throw new Error(`no element #${id}`);
  return found;
}

const BRANDS: BrandOption[] = brandOptions([
  { brandName: "Gunia" },
  { brandName: "Barricade" },
  { brandName: "Barricade" },
]);

/** Collapsed brand list without a search query. */
const LIST_STATE = {
  expanded: false,
  onToggleExpanded: () => {},
  query: "",
  onQuery: () => {},
};

function panel(
  appliedPrice: PriceRange,
  extra: {
    brands?: readonly BrandOption[] | null;
    selected?: string[];
    sizes?: readonly SizeOption[] | null;
    selectedSizes?: string[];
    activeCount?: number;
    isDrawer?: boolean;
  } = {},
) {
  return renderToString(
    <FilterPanel
      id="f"
      isDrawer={extra.isDrawer ?? false}
      onClose={() => {}}
      appliedPrice={appliedPrice}
      onApplyPrice={() => {}}
      onResetPrice={() => {}}
      brandOptions={extra.brands === undefined ? BRANDS : extra.brands}
      selectedBrands={extra.selected ?? []}
      onToggleBrand={() => {}}
      sizeOptions={extra.sizes === undefined ? [] : extra.sizes}
      selectedSizes={extra.selectedSizes ?? []}
      onToggleSize={() => {}}
      activeCount={extra.activeCount ?? 0}
      onResetAll={() => {}}
      resultCount={12}
      announcement={null}
    />,
  );
}

function priceView(draft: PriceDraft, applied: PriceRange = NO_PRICE_RANGE) {
  const onApply = vi.fn();
  const onReset = vi.fn();
  const onDraft = vi.fn();
  const props = { id: "p", applied, onApply, onReset, draft, onDraft };
  return {
    tree: PriceFilterView(props),
    markup: renderToString(<PriceFilterView {...props} />),
    onApply,
    onReset,
    onDraft,
  };
}

const card = (id: string, priceUah: number): FeedCard =>
  ({
    id,
    name: `Товар ${id}`,
    brandName: "Бренд",
    priceUah,
    photoUrl: "https://img.example/x.jpg",
    productUrl: "https://brand.example/x",
  }) as FeedCard;

function results(items: FeedCard[], filters: CatalogFilters) {
  const onRemoveChip = vi.fn();
  const onResetAll = vi.fn();
  const props = {
    status: "success" as const,
    items,
    visible: 24,
    chips: filterChips(filters, BRANDS),
    favoriteIds: new Set<string>(),
    onRetry: vi.fn(),
    onShowMore: vi.fn(),
    onRemoveChip,
    onResetAll,
  };
  return { tree: CatalogResults(props), props, onRemoveChip, onResetAll };
}

const price = (min: number | null, max: number | null): CatalogFilters => ({
  ...NO_FILTERS,
  minPrice: min,
  maxPrice: max,
});

describe("filter panel groups", () => {
  it("has «Категорія одягу», «Розмір», «Ціна», «Бренд» and no «Колір»", () => {
    const markup = panel(NO_PRICE_RANGE);
    for (const group of ["Категорія одягу", "Розмір", "Ціна", "Бренд"]) {
      expect(markup).toContain(group);
    }
    expect(markup).not.toContain("Колір");
  });

  it("all groups, «Ціна» included, are collapsed with «+» by default", () => {
    const markup = panel(NO_PRICE_RANGE);
    expect(markup.match(/aria-expanded="false"/g)).toHaveLength(4);
    expect(markup).not.toContain('aria-expanded="true"');
    expect(markup).not.toContain("Скоро");
    expect(markup).not.toContain('role="slider"');
    expect(markup.match(/>\+</g)).toHaveLength(4);
  });

  it("«Ціна» opens expanded when a price filter is applied", () => {
    const markup = panel({ min: 500, max: 2500 });
    expect(markup).toMatch(
      /id="f-price-button"[^>]*aria-expanded="true"[^>]*aria-controls="f-price-body"/,
    );
    expect(markup).toContain('id="f-price-body"');
    expect(markup).toContain("500 – 2500 грн");
    expect(markup.match(/role="slider"/g)).toHaveLength(2);
    expect(markup).toContain('value="500"');
    expect(markup).toContain('value="2\u00a0500"');
  });
});

describe("a collapsible group", () => {
  function group(open: boolean) {
    const onToggle = vi.fn();
    const props = {
      id: "g",
      title: "Ціна",
      open,
      onToggle,
      reduceMotion: true,
      children: <p>вміст</p>,
    };
    return {
      tree: FilterGroupView(props),
      markup: renderToString(<FilterGroupView {...props} />),
      onToggle,
    };
  }

  it("collapsed: «+», aria-expanded=false, no content; a click toggles", () => {
    const { tree, markup, onToggle } = group(false);
    expect(markup).toMatch(
      /<button id="g-button" type="button"[^>]*aria-expanded="false" aria-controls="g-body"/,
    );
    expect(markup).toContain(">+<");
    expect(markup).not.toContain("вміст");
    (byId(tree, "g-button").props.onClick as () => void)();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("expanded: «−» and the content in a region named by the heading", () => {
    const { markup } = group(true);
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain(">−<");
    expect(markup).toMatch(
      /id="g-body" role="region" aria-labelledby="g-button"/,
    );
    expect(markup).toContain("вміст");
  });
});

/** «2 500» in the fields and the button uses a no-break space. */
const plain = (text: string) => text.replace(/\u00a0/g, " ");

/** The «Показати …» button under the slider. */
function applyButton(tree: ReactNode) {
  const found = elements(tree).find(
    (element) =>
      element.type === "button" && text(element).startsWith("Показати"),
  );
  if (!found) throw new Error("no «Показати …» button");
  return found;
}

describe("price group: fields, slider, «Показати …»", () => {
  const start = initialPriceDraft(NO_PRICE_RANGE);

  it("[Від … грн] – [До … грн]: visible labels, numeric fields, «грн» inside, no «Ок»", () => {
    const { markup } = priceView(start);
    expect(markup).toMatch(/<label for="p-min"[^>]*>Від<\/label>/);
    expect(markup).toMatch(/<label for="p-max"[^>]*>До<\/label>/);
    expect(markup.match(/inputMode="numeric"/g)).toHaveLength(2);
    expect(markup.match(/aria-hidden="true">грн<\/span>/g)).toHaveLength(2);
    expect(markup).toContain('value="10\u00a0000"');
    expect(markup).not.toMatch(/>Ок</);
  });

  it("the button names the range and follows the draft: 4 variants", () => {
    const label = (min: number | null, max: number | null) =>
      plain(text(applyButton(priceView(initialPriceDraft({ min, max })).tree)));
    expect(label(500, 2500)).toBe("Показати від 500 до 2 500 грн");
    expect(label(null, 2500)).toBe("Показати до 2 500 грн");
    expect(label(500, null)).toBe("Показати від 500 грн");
    expect(label(null, null)).toBe("Показати всі ціни");
  });

  it("a click applies the range of the fields (one still being typed in too)", () => {
    const draft = { ...initialPriceDraft(NO_PRICE_RANGE), minText: "500" };
    const { tree, onApply } = priceView({ ...draft, maxText: "2500" });
    const button = applyButton(tree);
    expect(button.props.disabled).toBe(false);
    expect(plain(text(button))).toBe("Показати від 500 до 2 500 грн");
    (button.props.onClick as () => void)();
    expect(onApply).toHaveBeenCalledWith({ min: 500, max: 2500 });
  });

  it("Enter in a field commits it and applies", () => {
    const draft = { ...initialPriceDraft(NO_PRICE_RANGE), maxText: "2500" };
    const { tree, onDraft, onApply } = priceView(draft);
    const preventDefault = vi.fn();
    (byId(tree, "p-max").props.onKeyDown as (e: unknown) => void)({
      key: "Enter",
      preventDefault,
    });
    expect(preventDefault).toHaveBeenCalled();
    expect(onDraft).toHaveBeenLastCalledWith({ type: "commit", thumb: "max" });
    expect(onApply).toHaveBeenCalledWith({ min: null, max: 2500 });
  });

  it("disabled while the range equals the applied one; Enter then applies nothing", () => {
    const applied = { min: 500, max: 2500 };
    const same = priceView(initialPriceDraft(applied), applied);
    expect(applyButton(same.tree).props.disabled).toBe(true);
    expect(same.markup).toMatch(
      /<button type="button"[^>]*disabled=""[^>]*>Показати/,
    );
    (byId(same.tree, "p-min").props.onKeyDown as (e: unknown) => void)({
      key: "Enter",
      preventDefault: vi.fn(),
    });
    expect(same.onApply).not.toHaveBeenCalled();

    // No filter and the thumbs on the edges: nothing to apply either.
    expect(applyButton(priceView(start).tree).props.disabled).toBe(true);
  });

  it("two accessible thumbs, on the edges by default", () => {
    const { markup } = priceView(start);
    expect(markup).toMatch(
      /aria-label="Мінімальна ціна"[^>]*aria-valuemin="0" aria-valuemax="9900" aria-valuenow="0" aria-valuetext="від 0 грн"/,
    );
    expect(markup).toMatch(
      /aria-label="Максимальна ціна"[^>]*aria-valuemin="100" aria-valuemax="10000" aria-valuenow="10000" aria-valuetext="до 10000\+ грн"/,
    );
    expect(markup).toContain("left:0%");
    expect(markup).toContain("left:100%");
  });

  it("thumb positions follow the values; the dark part sits between them", () => {
    const { markup } = priceView(initialPriceDraft({ min: 500, max: 2500 }));
    expect(markup).toContain('aria-valuetext="від 500 грн"');
    expect(markup).toContain('aria-valuetext="до 2500 грн"');
    expect(markup).toContain("left:5%;width:20%");
  });

  it("fields send typing, and commit on blur", () => {
    const { tree, onDraft } = priceView(start);
    const min = byId(tree, "p-min");
    (min.props.onChange as (e: unknown) => void)({
      target: { value: "500" },
    });
    expect(onDraft).toHaveBeenLastCalledWith({
      type: "type",
      thumb: "min",
      text: "500",
    });
    (min.props.onBlur as () => void)();
    expect(onDraft).toHaveBeenLastCalledWith({ type: "commit", thumb: "min" });
  });

  it("«Скинути» appears only with an applied filter", () => {
    expect(priceView(start).markup).not.toContain("Скинути");
    const applied = { min: 500, max: null };
    const { tree, onReset } = priceView(initialPriceDraft(applied), applied);
    const reset = buttonByText(tree, "Скинути");
    expect(reset.props["aria-label"]).toBe("Скинути фільтр за ціною");
    (reset.props.onClick as () => void)();
    expect(onReset).toHaveBeenCalled();
  });
});

describe("catalogue results with filters", () => {
  function chips(tree: ReactNode) {
    return elements(tree).filter(
      (element) =>
        element.type === "button" &&
        String(element.props["aria-label"] ?? "").startsWith("Скинути фільтр:"),
    );
  }

  it("price chip «Ціна: 500 – 2500 грн»; its ✕ removes the price only", () => {
    const { tree, onRemoveChip } = results([card("a", 900)], price(500, 2500));
    const [chip] = chips(tree);
    expect(text(chip)).toBe("Ціна: 500 – 2500 грн");
    expect(chip?.props["aria-label"]).toBe(
      "Скинути фільтр: ціна 500 – 2500 грн",
    );
    (chip?.props.onClick as () => void)();
    expect(onRemoveChip).toHaveBeenCalledWith("price");
  });

  it("price chip for one side: «від 500 грн» / «до 2500 грн»", () => {
    expect(text(chips(results([], price(500, null)).tree)[0])).toBe(
      "Ціна: від 500 грн",
    );
    expect(text(chips(results([], price(null, 2500)).tree)[0])).toBe(
      "Ціна: до 2500 грн",
    );
  });

  it("a chip per brand; ✕ removes only that brand; «Скинути все» with 2+", () => {
    const filters = { ...price(null, 2000), brands: ["gunia", "barricade"] };
    const { tree, onRemoveChip, onResetAll } = results(
      [card("a", 900)],
      filters,
    );
    const all = chips(tree);
    expect(all.map(text)).toEqual(["Gunia", "Barricade", "Ціна: до 2000 грн"]);
    (all[1]?.props.onClick as () => void)();
    expect(onRemoveChip).toHaveBeenCalledWith("brand:barricade");
    expect(onRemoveChip).toHaveBeenCalledTimes(1);
    (buttonByText(tree, "Скинути все").props.onClick as () => void)();
    expect(onResetAll).toHaveBeenCalled();
  });

  it("one active filter: a chip, no «Скинути все»", () => {
    const { tree } = results([card("a", 900)], {
      ...NO_FILTERS,
      brands: ["gunia"],
    });
    expect(chips(tree)).toHaveLength(1);
    expect(() => buttonByText(tree, "Скинути все")).toThrow();
  });

  it("no chips without filters", () => {
    expect(chips(results([card("a", 900)], NO_FILTERS).tree)).toHaveLength(0);
  });

  it("nothing passes: «Немає одягу за цими фільтрами» and «Скинути все»", () => {
    const { tree, props, onResetAll } = results([], price(500, 600));
    const markup = renderToString(<CatalogResults {...props} />);
    expect(markup).toContain("Немає одягу за цими фільтрами");
    expect(markup).not.toContain("Товарів поки немає");
    (buttonByText(tree, "Скинути все").props.onClick as () => void)();
    expect(onResetAll).toHaveBeenCalled();
  });
});

describe("brand group", () => {
  it("collapsed with «+» by default; opens with the selected count", () => {
    const closed = panel(NO_PRICE_RANGE);
    expect(closed).toMatch(
      /id="f-brand-button"[^>]*aria-expanded="false"[^>]*aria-controls="f-brand-body"/,
    );
    expect(closed).not.toContain('type="checkbox"');

    const open = panel(NO_PRICE_RANGE, { selected: ["gunia", "barricade"] });
    expect(open).toMatch(/id="f-brand-button"[^>]*aria-expanded="true"/);
    expect(open).toMatch(/Бренд<span[^>]*>· 2<\/span>/);
    expect(open.match(/type="checkbox"/g)).toHaveLength(2);
  });

  it("the toggle of the group is the «+» button", () => {
    const onToggle = vi.fn();
    const tree = FilterGroupView({
      id: "b",
      title: "Бренд",
      open: false,
      onToggle,
      reduceMotion: true,
      children: null,
    });
    (byId(tree, "b-button").props.onClick as () => void)();
    expect(onToggle).toHaveBeenCalled();
  });

  it("no brands: the group is not shown; loading: «Завантаження…»", () => {
    expect(panel(NO_PRICE_RANGE, { brands: [] })).not.toContain("Бренд");
    const loading = BrandFilterView({
      id: "b",
      options: null,
      selected: [],
      onToggle: () => {},
      ...LIST_STATE,
    });
    expect(renderToString(loading)).toContain("Завантаження…");
  });

  it("a fieldset with legend «Бренд», a labelled checkbox per brand with its count", () => {
    const markup = renderToString(
      <BrandFilterView
        id="b"
        options={BRANDS}
        selected={["gunia"]}
        onToggle={() => {}}
        {...LIST_STATE}
      />,
    );
    expect(markup).toMatch(/<fieldset[^>]*><legend[^>]*>Бренд<\/legend>/);
    expect(markup).toMatch(
      /<label for="b-barricade"[^>]*><input id="b-barricade" type="checkbox"[^>]*\/>.*Barricade.*\(2\)/,
    );
    expect(markup).toMatch(/id="b-gunia" type="checkbox"[^>]*checked=""/);
    expect(markup).not.toMatch(/id="b-barricade" type="checkbox"[^>]*checked/);
    // Sorted: Barricade before Gunia.
    expect(markup.indexOf("Barricade")).toBeLessThan(markup.indexOf("Gunia"));
  });

  it("a click on a brand toggles it (the page adds or removes it in the URL)", () => {
    const onToggle = vi.fn();
    const tree = BrandFilterView({
      id: "b",
      options: BRANDS,
      selected: [],
      onToggle,
      ...LIST_STATE,
    });
    (byId(tree, "b-gunia").props.onChange as () => void)();
    expect(onToggle).toHaveBeenCalledWith("gunia");
  });

  /** 15 brands: «Бренд 10» … «Бренд 24» — more than 8 (button) and 12 (search). */
  const MANY = brandOptions(
    Array.from({ length: 15 }, (_, i) => ({ brandName: `Бренд ${i + 10}` })),
  );
  function list(
    expanded: boolean,
    extra: { selected?: string[]; query?: string } = {},
  ) {
    const onToggle = vi.fn();
    const onToggleExpanded = vi.fn();
    const props = {
      id: "b",
      options: MANY,
      selected: extra.selected ?? [],
      onToggle,
      expanded,
      onToggleExpanded,
      query: extra.query ?? "",
      onQuery: vi.fn(),
    };
    return {
      tree: BrandFilterView(props),
      markup: renderToString(<BrandFilterView {...props} />),
      onToggle,
      onToggleExpanded,
    };
  }
  const checkboxes = (markup: string) =>
    markup.match(/type="checkbox"/g)?.length ?? 0;

  it("collapsed: the first 8 and «Показати всі (15)» with aria-expanded=false", () => {
    const { tree, markup, onToggleExpanded } = list(false);
    expect(checkboxes(markup)).toBe(8);
    const button = buttonByText(tree, "Показати всі (15)");
    expect(button.props["aria-expanded"]).toBe(false);
    expect(button.props["aria-controls"]).toBe("b-list");
    expect(markup).toContain('id="b-list"');
    (button.props.onClick as () => void)();
    expect(onToggleExpanded).toHaveBeenCalledTimes(1);
  });

  it("«Показати всі» shows the full list in columns and turns into «Згорнути»", () => {
    const { tree, markup } = list(true);
    expect(checkboxes(markup)).toBe(15);
    expect(markup).toMatch(/id="b-list"[^>]*data-expanded="true"/);
    const button = buttonByText(tree, "Згорнути");
    expect(button.props["aria-expanded"]).toBe(true);
    expect(markup).not.toContain("Показати всі");
  });

  it("«Згорнути» keeps chosen brands visible, even beyond the first 8", () => {
    const chosen = MANY[13]?.key ?? "";
    const { markup } = list(false, { selected: [chosen] });
    expect(checkboxes(markup)).toBe(9);
    expect(markup).toMatch(
      new RegExp(`id="b-${chosen}" type="checkbox"[^>]*checked=""`),
    );
  });

  it("choosing a brand does not collapse the list", () => {
    const { tree, onToggle, onToggleExpanded } = list(true);
    const key = MANY[12]?.key ?? "";
    (byId(tree, `b-${key}`).props.onChange as () => void)();
    expect(onToggle).toHaveBeenCalledWith(key);
    expect(onToggleExpanded).not.toHaveBeenCalled();
    // The next render with the brand chosen is still the full list.
    expect(checkboxes(list(true, { selected: [key] }).markup)).toBe(15);
  });

  it("more than 12 brands: a labelled «Пошук бренду» field", () => {
    const { markup } = list(false);
    expect(markup).toMatch(/<label for="b-search"[^>]*>Пошук бренду<\/label>/);
    expect(markup).toMatch(/id="b-search" type="search"/);
    // 12 or fewer: no search.
    const few = renderToString(
      <BrandFilterView
        id="b"
        options={MANY.slice(0, 12)}
        selected={[]}
        onToggle={() => {}}
        {...LIST_STATE}
      />,
    );
    expect(few).not.toContain("Пошук бренду");
  });

  it("search filters the whole list, ignoring case, and announces the count", () => {
    const { markup } = list(false, { query: "  бРЕНД 2" });
    // «Бренд 20» … «Бренд 24».
    expect(checkboxes(markup)).toBe(5);
    expect(markup).toMatch(/aria-live="polite">Знайдено брендів: 5</);
    expect(markup).not.toContain("Показати всі");
  });

  it("search with no match: «Нічого не знайдено»", () => {
    const { markup } = list(true, { query: "zzz" });
    expect(checkboxes(markup)).toBe(0);
    expect(markup).toContain("Нічого не знайдено");
    expect(markup).toContain("Знайдено брендів: 0");
  });
});

describe("panel header and footer", () => {
  it("«Скинути все» next to «Фільтри» only when something is active", () => {
    expect(panel(NO_PRICE_RANGE)).not.toContain("Скинути все");
    expect(panel(NO_PRICE_RANGE, { activeCount: 1 })).toContain("Скинути все");
  });

  it("«Показати 12 товарів» at the bottom on every size (drawer and column)", () => {
    expect(panel(NO_PRICE_RANGE)).toContain("Показати 12 товарів");
    expect(panel(NO_PRICE_RANGE, { isDrawer: true })).toContain(
      "Показати 12 товарів",
    );
  });

  it("the panel starts narrow: «Показати всі» is not remembered between openings", () => {
    expect(panel(NO_PRICE_RANGE)).toContain('data-expanded="false"');
  });
});
