import { describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { Link, MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { FeedCard } from "../../api/types";
import { feedQueryKey } from "../feed/FeedPage";
import { BrandTile, BrandTileView, BrandTilesView } from "./BrandTiles";
import { logosByKey } from "./brandGrid";
import { CatalogPage } from "./CatalogPage";
import { brandOptions } from "./catalog";

vi.mock("../../shared/reveal", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../shared/reveal")>()),
  useReveal: () => () => undefined,
}));

type AnyProps = Record<string, unknown> & { children?: ReactNode };

function elements(node: ReactNode): ReactElement<AnyProps>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<AnyProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}

const card = (id: string, brandName: string, priceUah = 1000): FeedCard => ({
  id,
  name: `Товар ${id}`,
  brandName,
  priceUah,
  photoUrl: "https://img.example/x.jpg",
  productUrl: "https://brand.example/x",
});

const CATALOGUE = [
  card("m1", "MINT", 1200),
  card("m2", "Mint ", 3400),
  card("g1", "Gunia", 900),
  card("b1", "Barricade", 2000),
];

function page(url: string, items: FeedCard[] | null = CATALOGUE) {
  const client = new QueryClient();
  if (items !== null) client.setQueryData(feedQueryKey, { items });
  return renderToString(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <CatalogPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const BLOCK = 'aria-labelledby="brand-tiles-title"';

describe("brand tile", () => {
  it("links to /?brand=<key> with «Бренд X, N товарів» and scrolls up", () => {
    const scrollTo = vi.fn();
    vi.stubGlobal("window", { scrollTo });
    const [option] = brandOptions([
      { brandName: "Lucky Humanoid" },
      { brandName: "lucky humanoid" },
    ]);
    if (!option) throw new Error("no option");
    const tree = BrandTileView({
      option,
      logoUrl: null,
      onLogoError: () => {},
    });
    const link = elements(tree).find((element) => element.type === Link);
    expect(link?.props.to).toBe("/?brand=lucky+humanoid");
    expect(link?.props["aria-label"]).toBe("Бренд Lucky Humanoid, 2 товари");
    // no native title: it was drawn next to the pointer, over the neighbouring tile
    expect(link?.props.title).toBeUndefined();
    (link?.props.onClick as () => void)();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
    vi.unstubAllGlobals();
  });

  it("a name that fits: no tooltip at all (it would only repeat the visible name)", () => {
    const [option] = brandOptions([{ brandName: "MAGNETIC" }]);
    if (!option) throw new Error("no option");
    const markup = renderToString(
      <MemoryRouter>
        <BrandTileView option={option} logoUrl={null} onLogoError={() => {}} />
      </MemoryRouter>,
    );
    expect(markup).not.toContain("title=");
    expect(markup).not.toContain("_tooltip");
  });

  it("a cut-off name: the full name inside the same tile's box, not a neighbour's", () => {
    const options = brandOptions([
      { brandName: "MAGNETIC Studio of Very Long Names" },
      { brandName: "J. Cook" },
    ]);
    const markup = renderToString(
      <MemoryRouter>
        {options.map((option) => (
          <BrandTileView
            key={option.key}
            option={option}
            logoUrl={null}
            onLogoError={() => {}}
            truncated={option.label.length > 10}
          />
        ))}
      </MemoryRouter>,
    );
    const wraps = markup
      .split(/(?=<div class="[^"]*_tileWrap)/)
      .filter((part) => part !== "");
    expect(wraps).toHaveLength(2);
    const [cookWrap, magneticWrap] = wraps;
    // one wrapper per tile: the link and, only for the long name, its tooltip right after it
    expect(magneticWrap).toMatch(
      /^<div class="[^"]*_tileWrap[^"]*"><a[^>]*aria-label="Бренд MAGNETIC Studio of Very Long Names, 1 товар".*<\/a><span class="[^"]*_tooltip[^"]*" aria-hidden="true">MAGNETIC Studio of Very Long Names<\/span><\/div>$/s,
    );
    expect(cookWrap).not.toContain("_tooltip");
    expect(cookWrap).not.toContain("MAGNETIC");
  });

  it("renders the monogram, the name and the count", () => {
    const markup = renderToString(
      <MemoryRouter>
        <BrandTile option={{ key: "cher'17", label: "CHER'17", count: 5 }} />
      </MemoryRouter>,
    );
    expect(markup).toContain('href="/?brand=cher%2717"');
    expect(markup).toContain(">CH</span>");
    expect(markup).toContain("5 товарів");
    expect(markup).toContain("--monogram-bg:var(--monogram-");
  });
});

describe("«Бренди» block on the home page", () => {
  it("is a section with a heading, the count and a list of tiles", () => {
    const markup = page("/");
    expect(markup).toContain(`<section`);
    expect(markup).toContain(BLOCK);
    expect(markup).toMatch(/<h2 id="brand-tiles-title"[^>]*>Бренди/);
    expect(markup).toContain("3 бренди");
    expect(markup).toMatch(/<ul[^>]*id="brand-tiles-list"/);
    expect(markup).toContain('aria-label="Бренд MINT, 2 товари"');
    // Between the banner and «Усі товари».
    const block = markup.indexOf(BLOCK);
    expect(markup.indexOf("Почати свайпати")).toBeLessThan(block);
    expect(block).toBeLessThan(markup.indexOf(">Усі товари<"));
  });

  it.each([
    "/?maxPrice=2000",
    "/?brand=mint&brand=gunia",
    "/?brand=mint",
    "/?brand=nobody",
  ])("is hidden at %s", (url) => {
    expect(page(url)).not.toContain(BLOCK);
  });

  it("is hidden without brands", () => {
    expect(page("/", [])).not.toContain(BLOCK);
  });

  it("shows skeleton squares while loading", () => {
    const markup = page("/", null);
    expect(markup).toContain(BLOCK);
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("Завантажуємо бренди…");
    expect(markup).not.toContain('id="brand-tiles-list"');
  });
});

describe("«Усі бренди (N)»", () => {
  const options = brandOptions(
    Array.from({ length: 8 }, (_, index) => ({ brandName: `Brand ${index}` })),
  );

  function view(expanded: boolean, onToggle = () => {}) {
    return BrandTilesView({ options, columns: 3, expanded, onToggle });
  }

  const tiles = (tree: ReactNode) =>
    elements(tree).filter((element) => element.type === BrandTile);

  const toggle = (tree: ReactNode) => {
    const button = elements(tree).find((element) => element.type === "button");
    if (!button) throw new Error("no toggle button");
    return button;
  };

  it("shows two rows and «Усі бренди (8)» when collapsed", () => {
    const tree = view(false);
    expect(tiles(tree)).toHaveLength(6);
    const button = toggle(tree);
    expect(button.props.children).toBe("Усі бренди (8)");
    expect(button.props["aria-expanded"]).toBe(false);
    expect(button.props["aria-controls"]).toBe("brand-tiles-list");
  });

  it("expands to every brand and turns into «Згорнути»", () => {
    const onToggle = vi.fn();
    const collapsed = view(false, onToggle);
    (toggle(collapsed).props.onClick as () => void)();
    expect(onToggle).toHaveBeenCalledTimes(1);

    const expanded = view(true, onToggle);
    expect(tiles(expanded)).toHaveLength(8);
    expect(toggle(expanded).props.children).toBe("Згорнути");
    expect(toggle(expanded).props["aria-expanded"]).toBe(true);
    (toggle(expanded).props.onClick as () => void)();
    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(tiles(view(false))).toHaveLength(6);
  });

  it("has no button when every brand fits into two rows", () => {
    const tree = BrandTilesView({
      options,
      columns: 4,
      expanded: false,
      onToggle: () => {},
    });
    expect(tiles(tree)).toHaveLength(8);
    expect(elements(tree).some((element) => element.type === "button")).toBe(
      false,
    );
  });
});

describe("brand logo on a tile (GET /api/brands)", () => {
  const option = { key: "one by one", label: "One By One", count: 5 };
  const LOGO = "https://onebyone.ua/image/logo.png";

  function imgOf(tree: ReactNode) {
    return elements(tree).find((element) => element.type === "img");
  }

  it("shows the logo when there is a URL", () => {
    const markup = renderToString(
      <MemoryRouter>
        <BrandTile option={option} logoUrl={LOGO} />
      </MemoryRouter>,
    );
    const img = markup.match(/<img[^>]*>/)?.[0] ?? "";
    expect(img).toContain(`src="${LOGO}"`);
    expect(img).toContain('alt="Логотип One By One"');
    expect(img).toContain('loading="lazy"');
    expect(img).toMatch(/referrerPolicy="no-referrer"/i);
    expect(markup).not.toContain(">OB</span>");
    // The tile stays the same link with the same name.
    expect(markup).toContain('aria-label="Бренд One By One, 5 товарів"');
  });

  it("shows the monogram without a URL", () => {
    const markup = renderToString(
      <MemoryRouter>
        <BrandTile option={option} />
      </MemoryRouter>,
    );
    expect(markup).not.toContain("<img");
    expect(markup).toContain(">OB</span>");
  });

  it("falls back to the monogram when the image fails to load", () => {
    const onLogoError = vi.fn();
    const withLogo = BrandTileView({ option, logoUrl: LOGO, onLogoError });
    const img = imgOf(withLogo);
    expect(img?.props.src).toBe(LOGO);
    // The browser's error event reports the failed URL to BrandTile…
    (img?.props.onError as () => void)();
    expect(onLogoError).toHaveBeenCalledTimes(1);
    // …which renders the view again without it: the monogram.
    const fallback = BrandTileView({ option, logoUrl: null, onLogoError });
    expect(imgOf(fallback)).toBeUndefined();
    expect(
      elements(fallback).some((element) => element.props.children === "OB"),
    ).toBe(true);
  });

  it("matches GET /api/brands with the tiles by brandKey and drops unsafe URLs", () => {
    const logos = logosByKey([
      { key: "one by one", name: "One By One", logoUrl: LOGO, productCount: 5 },
      {
        key: "CHER’17",
        name: "CHER'17",
        logoUrl: "/api/images/abc",
        productCount: 3,
      },
      { key: "mint", name: "Mint", logoUrl: null, productCount: 2 },
      {
        key: "bad",
        name: "Bad",
        logoUrl: "javascript:alert(1)",
        productCount: 1,
      },
      {
        key: "old",
        name: "Old",
        logoUrl: "http://old.example/logo.png",
        productCount: 1,
      },
    ]);
    expect([...logos]).toEqual([
      ["one by one", LOGO],
      ["cher'17", "/api/images/abc"],
    ]);
  });

  it("passes the logo of each brand to its tile", () => {
    const options = brandOptions([
      { brandName: "One By One" },
      { brandName: "Mint" },
    ]);
    const tree = BrandTilesView({
      options,
      logos: new Map([["one by one", LOGO]]),
      columns: 3,
      expanded: false,
      onToggle: () => {},
    });
    const tiles = elements(tree).filter(
      (element) => element.type === BrandTile,
    );
    expect(tiles.map((tile) => tile.props.logoUrl)).toEqual([null, LOGO]);
  });
});

describe("which brands get a tile (published cards only)", () => {
  // The tiles come from GET /api/feed, which has only Published cards (INV-01): a brand with
  // 0 published cards is not in it, and the count is its published cards.
  it("a brand with 0 published cards has no tile; with 1 it has one with «1 товар»", () => {
    expect(page("/", [card("x1", "MINT")])).not.toContain("Бренд Gunia");
    const markup = page("/", [card("x1", "MINT"), card("g1", "Gunia")]);
    expect(markup).toContain('aria-label="Бренд Gunia, 1 товар"');
    expect(markup).toContain('aria-label="Бренд MINT, 1 товар"');
  });

  it("a registered and a demo brand of the same name are one tile with both counts", () => {
    const options = brandOptions([
      { brandName: "BEVZA (demo)" },
      { brandName: "BEVZA (demo)" },
      { brandName: "Bevza  (Demo)" },
    ]);
    expect(options).toEqual([
      { key: "bevza (demo)", label: "BEVZA (demo)", count: 3 },
    ]);
  });

  it("logo: the URL from /api/brands when there is one, else the monogram", () => {
    const logos = logosByKey([
      {
        key: "bevza (demo)",
        name: "BEVZA (demo)",
        logoUrl: "https://bevza.com/logo.png",
        productCount: 2,
      },
      { key: "mint", name: "MINT", logoUrl: null, productCount: 1 },
    ]);
    const tile = (name: string) =>
      renderToString(
        <MemoryRouter>
          <BrandTileView
            option={brandOptions([{ brandName: name }])[0]!}
            logoUrl={
              logos.get(brandOptions([{ brandName: name }])[0]!.key) ?? null
            }
            onLogoError={() => {}}
          />
        </MemoryRouter>,
      );
    expect(tile("BEVZA (demo)")).toMatch(
      /<img[^>]*src="https:\/\/bevza.com\/logo.png"/,
    );
    expect(tile("MINT")).not.toContain("<img");
    expect(tile("MINT")).toMatch(/class="[^"]*_monogram/);
  });
});
