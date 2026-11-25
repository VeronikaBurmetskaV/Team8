import { describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { Link, MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { FeedCard } from "../../api/types";
import { toggleFavorite } from "../../shared/productLists";
import { feedQueryKey } from "../feed/FeedPage";
import { CatalogPage } from "./CatalogPage";
import { CatalogTile, CatalogTileView } from "./CatalogTile";

// The heart's action is spied on: a click on the brand name must never reach it.
vi.mock("../../shared/productLists", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../shared/productLists")>()),
  toggleFavorite: vi.fn(),
}));

// The tile is also called as a plain function below: its entrance animation is not under test.
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

/** The whole home page at `url`, with the catalogue already loaded. */
function page(url: string) {
  const client = new QueryClient();
  client.setQueryData(feedQueryKey, { items: CATALOGUE });
  return renderToString(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <CatalogPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const productNames = (markup: string) =>
  [...markup.matchAll(/title="(Товар \w+)"/g)].map((match) => match[1]);

describe("brand name on a catalogue tile", () => {
  it("is a link to /?brand=<key> with «Увесь одяг бренду …»", () => {
    const markup = renderToString(
      <MemoryRouter>
        <CatalogTile
          card={card("x", "  Cher'17 ")}
          isFavorite={false}
          index={0}
        />
      </MemoryRouter>,
    );
    const link = markup.match(/<a [^>]*>/)?.[0] ?? "";
    expect(link).toContain('href="/?brand=cher%2717"');
    expect(link).toContain('aria-label="Увесь одяг бренду Cher&#x27;17"');
  });

  it("a click on it scrolls to the top and does not like the product", () => {
    const scrollTo = vi.fn();
    vi.stubGlobal("window", { scrollTo });
    const onLike = vi.fn();
    const onOpen = vi.fn();
    const tree = CatalogTileView({
      card: card("x", "MINT"),
      isFavorite: false,
      onLike,
      onOpen,
    });
    const link = elements(tree).find((element) => element.type === Link);
    try {
      expect(link?.props.to).toBe("/?brand=mint");
      (link?.props.onClick as () => void)();
      expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
      // neither a like nor the full card (the link is not inside «Відкрити картку»)
      expect(onLike).not.toHaveBeenCalled();
      expect(onOpen).not.toHaveBeenCalled();
      expect(toggleFavorite).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("brand page (/?brand=<key>)", () => {
  it("shows the brand heading, «← Весь одяг», only its products, no banner", () => {
    const markup = page("/?brand=mint");
    expect(markup).toMatch(/<a[^>]*href="\/"[^>]*>.*Весь одяг<\/a>/);
    expect(markup).toContain(">Бренд</p>");
    expect(markup).toMatch(/<h1[^>]*>MINT<\/h1>/);
    expect(markup).toContain("2 товари");
    expect(productNames(markup)).toEqual(["Товар m1", "Товар m2"]);
    expect(markup).not.toContain("Почати свайпати");
    expect(markup).not.toContain('href="/feed"');
    // No chip for the brand the heading already names.
    expect(markup).not.toContain("Скинути фільтр: бренд");
    expect(markup).not.toContain("Усі товари</h2>");
  });

  it("with a price added: the ordinary catalogue with chips", () => {
    const markup = page("/?brand=mint&maxPrice=2000");
    expect(markup).toContain("Почати свайпати");
    expect(markup).not.toContain("Весь одяг</a>");
    expect(markup).toContain('aria-label="Скинути фільтр: бренд MINT"');
    expect(markup).toContain('aria-label="Скинути фільтр: ціна до 2000 грн"');
    expect(productNames(markup)).toEqual(["Товар m1"]);
  });

  it("with a second brand: the ordinary catalogue with a chip per brand", () => {
    const markup = page("/?brand=mint&brand=gunia");
    expect(markup).toContain("Почати свайпати");
    expect(markup).toContain('aria-label="Скинути фільтр: бренд Gunia"');
    expect(productNames(markup)).toEqual(["Товар m1", "Товар m2", "Товар g1"]);
  });

  it("an unknown brand: «Товарів цього бренду поки немає» and «← Весь одяг»", () => {
    const markup = page("/?brand=nobody");
    expect(markup).toContain("Товарів цього бренду поки немає");
    expect(markup).toMatch(/href="\/"[^>]*>.*Весь одяг<\/a>/);
    expect(productNames(markup)).toEqual([]);
    expect(markup).not.toContain("Почати свайпати");
  });

  it("the home page without filters is unchanged", () => {
    const markup = page("/");
    expect(markup).toContain("Почати свайпати");
    expect(markup).toContain("Усі товари");
    expect(productNames(markup)).toHaveLength(4);
  });
});
