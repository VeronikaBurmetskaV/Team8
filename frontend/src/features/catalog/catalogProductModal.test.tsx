import { describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import {
  createMemoryRouter,
  Link,
  MemoryRouter,
  RouterProvider,
} from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { FeedCard } from "../../api/types";
import { ProductModalView } from "../../shared/SavedProducts/ProductModal";
import { feedQueryKey } from "../feed/FeedPage";
import { CatalogPage } from "./CatalogPage";
import { CatalogTile, CatalogTileView } from "./CatalogTile";
import {
  closeAction,
  productOfUrl,
  withProduct,
  withoutProduct,
} from "./productParam";

// The tile's entrance animation is not under test.
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
  name: `Сукня ${id}`,
  brandName,
  priceUah,
  photoUrl: "https://img.example/x.jpg",
  productUrl: "https://brand.example/x",
  sizes: [{ label: "S", available: true }],
  description: "Льон",
});

const CATALOGUE = [card("m1", "MINT", 1200), card("g1", "Gunia", 900)];

function feedClient() {
  const client = new QueryClient();
  client.setQueryData(feedQueryKey, { items: CATALOGUE });
  return client;
}

/** The home page at `url`, with the catalogue already loaded. */
function page(url: string) {
  return renderToString(
    <QueryClientProvider client={feedClient()}>
      <MemoryRouter initialEntries={[url]}>
        <CatalogPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The full card in the markup: the panel with the product's name, or null. */
const openCardName = (markup: string) =>
  markup.match(
    /<dialog[^>]*role="dialog"[^>]*>.*?<h\d[^>]*id="[^"]+"[^>]*>([^<]+)</s,
  )?.[1] ?? null;

describe("a catalogue tile opens the full card", () => {
  const tile = (onOpen = vi.fn(), onLike = vi.fn()) => ({
    all: elements(
      CatalogTileView({
        card: CATALOGUE[1]!,
        isFavorite: false,
        onOpen,
        onLike,
      }),
    ),
    onOpen,
    onLike,
  });

  it("a click on the photo (or anywhere but the heart and the brand) opens that product", () => {
    const { all, onOpen } = tile();
    const open = all.find((element) => element.props["data-open-product"]);
    expect(open?.type).toBe("button");
    expect(open?.props["aria-label"]).toBe("Відкрити картку: Сукня g1");
    (open?.props.onClick as () => void)();
    expect(onOpen).toHaveBeenCalledWith(CATALOGUE[1]);
  });

  it("the heart and the brand link do their own thing and never open the card", () => {
    const { all, onOpen, onLike } = tile();
    const heart = all.find(
      (element) =>
        element.props["aria-label"] === "Додати у Вподобане: Сукня g1",
    );
    (heart?.props.onClick as () => void)();
    expect(onLike).toHaveBeenCalledTimes(1);
    const brand = all.find((element) => element.type === Link);
    const scrollTo = vi.fn();
    vi.stubGlobal("window", { scrollTo });
    (brand?.props.onClick as () => void)();
    vi.unstubAllGlobals();
    expect(onOpen).not.toHaveBeenCalled();
    // Not nested in «Відкрити картку»: siblings, so their clicks never bubble into it, and
    // they stay their own focusable elements.
    const open = all.find((element) => element.props["data-open-product"]);
    expect(open?.props.children).toBeUndefined();
  });

  it("Enter and Space open it too: it is a real <button> reached by Tab", () => {
    const markup = renderToString(
      <MemoryRouter>
        <CatalogTileView
          card={CATALOGUE[1]!}
          isFavorite={false}
          onOpen={() => {}}
          onLike={() => {}}
        />
      </MemoryRouter>,
    );
    const open =
      markup.match(/<button[^>]*data-open-product="g1"[^>]*>/)?.[0] ?? "";
    expect(open).toContain('type="button"');
    expect(open).not.toContain("tabindex");
  });

  it("the tile's markup is unchanged: the same elements and classes, plus the one button", () => {
    const render = (onOpen?: (card: FeedCard) => void) =>
      renderToString(
        <MemoryRouter>
          <CatalogTile
            card={CATALOGUE[1]!}
            isFavorite={false}
            index={0}
            onOpen={onOpen}
          />
        </MemoryRouter>,
      );
    const without = render();
    const withOpen = render(() => {});
    // remove the new transparent button: everything else is byte for byte the same
    expect(
      withOpen.replace(
        /<button[^>]*data-open-product="g1"[^>]*><\/button>/,
        "",
      ),
    ).toBe(without);
    const classes = [...without.matchAll(/class="_(\w+)_/g)].map(
      (match) => match[1],
    );
    expect(classes).toEqual([
      "tile",
      "photoBox",
      "photo",
      "heart",
      "brand",
      "name",
      "priceRow",
      "price",
      ...classes.slice(8),
    ]);
  });
});

describe("?product=<id>: the full card in the address", () => {
  it("opening adds ?product=<id> and keeps the filters", () => {
    const params = new URLSearchParams("brand=gunia&maxPrice=2000");
    expect(withProduct(params, "g1").toString()).toBe(
      "brand=gunia&maxPrice=2000&product=g1",
    );
    expect(withoutProduct(withProduct(params, "g1")).toString()).toBe(
      "brand=gunia&maxPrice=2000",
    );
  });

  it("a page opened with ?product=<id> shows that card at once, filters kept", () => {
    const markup = page("/?brand=gunia&product=g1");
    expect(openCardName(markup)).toBe("Сукня g1");
    expect(markup).toMatch(
      /<dialog[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="[^"]+"/,
    );
    expect(markup).toContain("Перейти на сайт бренду");
    // the heart is in the full card too, in the tile's state
    expect(markup).toMatch(
      /<dialog.*<button[^>]*aria-label="Додати у Вподобане: Сукня g1"[^>]*aria-pressed="false"/s,
    );
    // the brand page behind it is still the brand page (only Gunia's products)
    expect(markup).not.toContain("Сукня m1");
  });

  it("an id the catalogue does not have is ignored", () => {
    expect(
      productOfUrl(new URLSearchParams("product=nope"), CATALOGUE),
    ).toBeNull();
    expect(openCardName(page("/?product=nope"))).toBeNull();
    expect(openCardName(page("/"))).toBeNull();
  });

  it("«Назад» in the browser closes it", async () => {
    const router = createMemoryRouter(
      [{ path: "/", element: <CatalogPage /> }],
      { initialEntries: ["/", "/?product=g1"], initialIndex: 1 },
    );
    const render = () =>
      renderToString(
        <QueryClientProvider client={feedClient()}>
          <RouterProvider router={router} />
        </QueryClientProvider>,
      );
    expect(openCardName(render())).toBe("Сукня g1");
    await router.navigate(-1);
    expect(openCardName(render())).toBeNull();
  });

  it("«×», Esc and the backdrop: one step back after opening from the page, else drop the param", () => {
    const params = new URLSearchParams("brand=gunia&product=g1");
    expect(closeAction({ productModal: true }, params)).toEqual({
      kind: "back",
    });
    const fromLink = closeAction(null, params);
    expect(fromLink.kind).toBe("replace");
    expect(fromLink.kind === "replace" && fromLink.params.toString()).toBe(
      "brand=gunia",
    );

    // Esc reaches the same onClose as «×» and the dimmed page
    const onClose = vi.fn();
    const all = elements(
      ProductModalView({
        product: CATALOGUE[1]!,
        onClose,
        heart: {
          pressed: true,
          label: "Додати у Вподобане: Сукня g1",
          onToggle: () => {},
        },
        titleId: "t",
        reduceMotion: true,
      }),
    );
    const esc = { preventDefault: vi.fn() };
    (all[0]?.props.onCancel as (event: typeof esc) => void)(esc);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("the heart in the full card is the tile's: same state, same action", () => {
    const onToggle = vi.fn();
    const all = elements(
      ProductModalView({
        product: CATALOGUE[1]!,
        onClose: () => {},
        heart: {
          pressed: true,
          label: "Додати у Вподобане: Сукня g1",
          onToggle,
        },
        titleId: "t",
        reduceMotion: true,
      }),
    );
    const heart = all.find(
      (element) =>
        element.props["aria-label"] === "Додати у Вподобане: Сукня g1",
    );
    expect(heart?.props["aria-pressed"]).toBe(true);
    (heart?.props.onClick as () => void)();
    expect(onToggle).toHaveBeenCalledTimes(1);
    // «Вподобане» passes no heart: its modal keeps only «×»
    const plain = elements(
      ProductModalView({
        product: CATALOGUE[1]!,
        onClose: () => {},
        titleId: "t",
        reduceMotion: true,
      }),
    );
    expect(
      plain.some((element) => element.props["aria-pressed"] !== undefined),
    ).toBe(false);
  });
});
