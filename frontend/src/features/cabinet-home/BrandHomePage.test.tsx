import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type { BrandCard, BrandProfileResponse } from "../../api/types";
import { brandProfileQueryKey } from "../../shared/brandProfile";
import { brandProductsKey } from "../cabinet-products/queries";
import { BrandHomePage } from "./BrandHomePage";

const activeProfile: BrandProfileResponse = {
  name: "Тестовий бренд",
  logoImageId: null,
  logoUrl: null,
  logoDisplayUrl: null,
  consentGiven: true,
  consentGivenAt: "2026-11-23T10:00:00Z",
  consentText: "Згода",
  state: "CONSENTED",
};

const incompleteProfile: BrandProfileResponse = {
  ...activeProfile,
  name: null,
  consentGiven: false,
  consentGivenAt: null,
  consentText: null,
  state: "INCOMPLETE",
};

function card(id: string, status: BrandCard["status"]): BrandCard {
  return { id, status } as BrandCard;
}

/** Renders /brand with the two queries already answered (no network in the test). */
function render(profile: BrandProfileResponse, products: BrandCard[]): string {
  const client = new QueryClient();
  client.setQueryData(brandProfileQueryKey, profile);
  client.setQueryData(brandProductsKey, products);
  return renderToString(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/brand"]}>
        <BrandHomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const link = (href: string, text: string) =>
  new RegExp(`<a[^>]*href="${href}"[^>]*>${text}</a>`);

describe("/brand", () => {
  it("shows the big «Додати товар» leading to the new product form for an active profile", () => {
    const html = render(activeProfile, [card("1", "PUBLISHED")]);
    expect(html).toMatch(link("/brand/products/new", "Додати товар"));
    expect(html).not.toContain("Спочатку збережіть назву бренду в профілі");
  });

  it("shows the profile hint instead of the button for an INCOMPLETE profile", () => {
    const html = render(incompleteProfile, []);
    expect(html).not.toContain('href="/brand/products/new"');
    expect(html).toContain("Спочатку збережіть назву бренду в профілі");
    expect(html).toMatch(link("/brand/profile", "Заповнити профіль бренду"));
  });

  it("shows the brand name and the consent date", () => {
    const html = render(activeProfile, []);
    expect(html).toContain("Тестовий бренд");
    expect(html).toContain("Дана 23.11.2026");
  });

  it("shows that consent is not given yet", () => {
    expect(render(incompleteProfile, [])).toContain("Не дана");
  });

  it("counts all, published and draft products", () => {
    const html = render(activeProfile, [
      card("1", "PUBLISHED"),
      card("2", "DRAFT"),
      card("3", "DRAFT"),
    ]);
    expect(html).toMatch(/Усього<\/dt><dd>3</);
    expect(html).toMatch(/Опубліковано<\/dt><dd>1</);
    expect(html).toMatch(/Чернетки<\/dt><dd>2</);
    expect(html).not.toContain("У вас поки немає товарів");
  });

  it("shows a friendly text when there are no products", () => {
    expect(render(activeProfile, [])).toContain("У вас поки немає товарів");
  });

  it("links to the profile editor and to all products", () => {
    const html = render(activeProfile, []);
    expect(html).toMatch(link("/brand/profile", "Редагувати профіль"));
    expect(html).toMatch(link("/brand/products", "Усі товари"));
  });
});
