import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { FeedCard } from "../../api/types";
import { BuyerHeaderView } from "../../shared/BuyerHeader";
import { memoryStorage } from "../../shared/testStorage";
import { CatalogPage } from "../catalog/CatalogPage";
import { SAVED_FILTERS_KEY } from "../catalog/filterState";
import { FeedPage, feedQueryKey } from "./FeedPage";

vi.mock("../../shared/reveal", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../shared/reveal")>()),
  useReveal: () => () => undefined,
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

const card = (id: string, brandName: string, priceUah: number): FeedCard => ({
  id,
  name: `Товар ${id}`,
  brandName,
  priceUah,
  photoUrl: "https://img.example/x.jpg",
  productUrl: "https://brand.example/x",
});

const FEED = [
  card("m1", "MINT", 1200),
  card("g1", "Gunia", 900),
  card("m2", "Mint", 3400),
  card("b1", "Barricade", 2000),
];

function render(url: string, page: "feed" | "catalog" = "feed") {
  const client = new QueryClient();
  client.setQueryData(feedQueryKey, { items: FEED });
  return renderToString(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        {page === "feed" ? <FeedPage /> : <CatalogPage />}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The cards on the deck (the top one and the one under it), sorted. */
const shownCards = (html: string) =>
  [
    ...new Set([...html.matchAll(/Товар (\w+)/g)].map((match) => match[1])),
  ].sort();

describe("/feed with the catalogue filters", () => {
  it("shows only the cards that pass the filters", () => {
    expect(shownCards(render("/feed?brand=mint"))).toEqual(["m1", "m2"]);
    expect(shownCards(render("/feed?maxPrice=1000"))).toEqual(["g1"]);
    // Without filters: the first two cards of the deck, as before.
    expect(shownCards(render("/feed"))).toEqual(["g1", "m1"]);
  });

  it("has «Фільтри» with the count, aria-expanded and the chips", () => {
    const html = render("/feed?maxPrice=2500&brand=mint");
    const button = html.match(
      /<button[^>]*aria-controls="feed-filters"[^>]*>/,
    )?.[0];
    expect(button).toContain('aria-expanded="false"');
    expect(html).toContain("активних фільтрів: 2");
    expect(html).toContain('aria-label="Скинути фільтр: бренд MINT"');
    expect(html).toContain('aria-label="Скинути фільтр: ціна до 2500 грн"');
    expect(html).toContain(">Скинути все<");
  });

  it("shows its own empty state when no unviewed card passes the filters", () => {
    const html = render("/feed?maxPrice=500&brand=mint");
    expect(html).toContain("За цими фільтрами нових карток немає");
    expect(html).not.toContain("Ви переглянули всі доступні речі");
    expect(html).toMatch(/<button[^>]*>Скинути фільтри<\/button>/);
    expect(html).toMatch(
      /<a[^>]*href="\/\?maxPrice=500&amp;brand=mint"[^>]*>Дивитися каталог<\/a>/,
    );
  });
});

describe("«Повернути фільтри»", () => {
  function withSaved(query: string) {
    const storage = memoryStorage();
    storage.setItem(SAVED_FILTERS_KEY, query);
    vi.stubGlobal("localStorage", storage);
  }

  it("is offered on /feed and / opened without filters, never applied by itself", () => {
    withSaved("maxPrice=2500&brand=mint");
    for (const [url, page] of [
      ["/feed", "feed"],
      ["/", "catalog"],
    ] as const) {
      const html = render(url, page);
      expect(html).toContain("Повернути фільтри: MINT, Ціна: до 2500 грн");
      expect(html).not.toContain("Скинути фільтр:");
    }
    // Nothing applied: the whole feed is there.
    expect(shownCards(render("/feed"))).toEqual(["g1", "m1"]);
  });

  it("is not offered when the URL already has filters or nothing is saved", () => {
    withSaved("maxPrice=2500");
    expect(render("/feed?brand=gunia")).not.toContain("Повернути фільтри");
    vi.stubGlobal("localStorage", memoryStorage());
    expect(render("/feed")).not.toContain("Повернути фільтри");
  });
});

describe("links between / and /feed carry the filters", () => {
  it("the banner on / opens /feed with the same filters", () => {
    const html = render("/?maxPrice=2500&brand=mint&brand=gunia", "catalog");
    expect(html).toContain(
      'href="/feed?maxPrice=2500&amp;brand=mint&amp;brand=gunia"',
    );
  });

  it("the header's swipe icon and logo keep them", () => {
    const noop = () => {};
    const html = renderToString(
      <MemoryRouter>
        <BuyerHeaderView
          mode="full"
          enter={null}
          content={{
            pathname: "/feed",
            search: "?maxPrice=2500&brand=mint",
            city: "kyiv",
            onCity: noop,
            language: "UA",
            onLanguage: noop,
            newFavorites: 0,
          }}
          reveal={false}
          panelId="p"
          fullHeight={null}
          barHeight={null}
          animating={false}
          reduceMotion
          onToggle={noop}
          onLogo={noop}
        />
      </MemoryRouter>,
    );
    const link = (label: string) =>
      html.match(new RegExp(`<a[^>]*aria-label="${label}"[^>]*>`))?.[0] ?? "";
    expect(link("Свайпати")).toContain(
      'href="/feed?maxPrice=2500&amp;brand=mint"',
    );
    expect(link("FULLA — на головну")).toContain(
      'href="/?maxPrice=2500&amp;brand=mint"',
    );
  });
});

describe("/feed with the size filter", () => {
  const sized = (id: string, labels: string[]): FeedCard => ({
    ...card(id, "Cape", 1500),
    sizes: labels.map((label) => ({ label, available: true })),
  });

  function renderFeed(url: string) {
    const client = new QueryClient();
    client.setQueryData(feedQueryKey, {
      items: [
        sized("s1", ["S", "M"]),
        card("plain", "Mint", 900),
        sized("s2", ["xs"]),
        sized("s3", ["m"]),
      ],
    });
    return renderToString(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[url]}>
          <FeedPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it("shows only the unviewed cards that have a chosen size in stock", () => {
    expect(shownCards(renderFeed("/feed?size=M"))).toEqual(["s1", "s3"]);
    expect(shownCards(renderFeed("/feed?size=XS"))).toEqual(["s2"]);
    expect(renderFeed("/feed?size=M")).toContain(
      'aria-label="Скинути фільтр: розмір M"',
    );
  });
});

describe("the next card while the top card is flipped (no see-through flip)", () => {
  const css = readFileSync("src/features/feed/FeedPage.module.css", "utf8");

  it("the deck tells its CSS whether the top card is flipped or flying off", () => {
    const deck = render("/feed").match(/<div[^>]*role="region"[^>]*>/)?.[0];
    expect(deck).toContain('data-flipped="false"');
    expect(deck).toContain('data-flying="false"');
  });

  it("hides the next card at once on a flip and shows it only after the flip back", () => {
    expect(css).toMatch(
      /\.deck\[data-flipped="true"\] > \.underCard\s*{[^}]*visibility: hidden;[^}]*transition: none;/,
    );
    expect(css).toMatch(
      /\.underCard\s*{[^}]*transition: visibility 0s linear var\(--card-flip-duration\);/,
    );
  });

  it("shows the next card at once when the top card flies off, and without motion", () => {
    expect(css).toMatch(
      /\.deck\[data-flying="true"\] > \.underCard\s*{\s*transition: none;/,
    );
    expect(css).toMatch(
      /prefers-reduced-motion: reduce\)[\s\S]*\.underCard\s*{[^}]*transition: none;/,
    );
  });

  it("uses the card's own flip duration", () => {
    const card = readFileSync(
      "src/shared/ProductCard/ProductCard.module.css",
      "utf8",
    );
    const tokens = readFileSync("src/shared/tokens.css", "utf8");
    expect(card).toMatch(/transition: transform var\(--card-flip-duration\)/);
    expect(tokens).toMatch(/--card-flip-duration: \d+ms;/);
  });
});
