import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { FeedCard } from "../../api/types";
import { feedQueryKey } from "../feed/FeedPage";
import { BrandTile } from "./BrandTiles";
import { CatalogPage } from "./CatalogPage";
import { brandOptions, withBrandToggled } from "./catalog";

vi.mock("../../shared/reveal", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../shared/reveal")>()),
  useReveal: () => () => undefined,
}));

const card = (id: string, brandName: string): FeedCard => ({
  id,
  name: `Товар ${id}`,
  brandName,
  priceUah: 1000,
  photoUrl: "https://img.example/x.jpg",
  productUrl: "https://brand.example/x",
});

/** The same two brands, spelled the way different sources and people spell them. */
const CATALOGUE = [
  card("c1", "CHER'17"),
  card("c2", "CHER’17"),
  card("c3", "cher'17 "),
  card("o1", "One By One"),
  card("o2", "One By One"),
  card("o3", "ONE BY ONE"),
  card("m1", "Mint"),
];

/** A fresh page at `url`, as after a reload: new router, new cache, the same feed. */
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

const productIds = (markup: string) =>
  [...markup.matchAll(/title="Товар (\w+)"/g)].map((match) => match[1]);

describe.each([
  ["CHER'17", ["c1", "c2", "c3"]],
  ["One By One", ["o1", "o2", "o3"]],
])("brand %s, spelled three ways", (label, ids) => {
  const option = brandOptions(CATALOGUE).find((o) => o.label === label);
  if (!option) throw new Error(`no brand option ${label}`);

  it("is one brand with every product", () => {
    expect(option.count).toBe(3);
  });

  it("its tile opens a brand page with all its products, also after a reload", () => {
    const tile = renderToString(
      <MemoryRouter>
        <BrandTile option={option} />
      </MemoryRouter>,
    );
    const href = tile.match(/href="([^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
    if (!href) throw new Error("tile has no link");
    const markup = page(href);
    expect(markup).not.toContain("Товарів цього бренду поки немає");
    expect(productIds(markup)).toEqual(ids);
  });

  it("its filter checkbox shows all its products", () => {
    const params = withBrandToggled(
      new URLSearchParams("maxPrice=5000"),
      label,
    );
    const markup = page(`/?${params.toString()}`);
    expect(productIds(markup)).toEqual(ids);
  });

  it("the brand link on each of its product tiles leads to the same page", () => {
    const home = page("/");
    for (const id of ids) {
      const tile = home
        .split("<li")
        .find((part) => part.includes(`title="Товар ${id}"`));
      if (!tile) throw new Error(`no tile ${id}`);
      const brandLink = tile.match(/href="(\/\?brand=[^"]+)"/)?.[1];
      expect(brandLink).toBe(`/?${new URLSearchParams({ brand: option.key })}`);
    }
  });
});
