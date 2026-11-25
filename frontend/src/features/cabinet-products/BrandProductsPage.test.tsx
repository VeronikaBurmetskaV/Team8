import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type {
  BrandCard,
  BrandProfileResponse,
  ProfileState,
} from "../../api/types";
import { brandProfileQueryKey } from "../../shared/brandProfile";
import { messages } from "../../shared/messages.uk";
import { BrandProductsPage } from "./BrandProductsPage";
import { brandProductsKey } from "./queries";

function profile(state: ProfileState): BrandProfileResponse {
  const consented = state === "CONSENTED";
  return {
    name: state === "INCOMPLETE" ? null : "Тестовий бренд",
    logoImageId: null,
    logoUrl: null,
    logoDisplayUrl: null,
    consentGiven: consented,
    consentGivenAt: consented ? "2026-11-23T10:00:00Z" : null,
    consentText: consented ? "Згода" : null,
    state,
  };
}

function card(id: string, status: BrandCard["status"]): BrandCard {
  return {
    id,
    name: "Лляна сукня міді",
    brandName: "Тестовий бренд",
    priceUah: 2400,
    photoUrl: "https://cdn.brand-site.ua/dress.webp",
    productUrl: "https://brand-site.ua/linen-dress",
    photoImageId: null,
    status,
    publishedAt: status === "PUBLISHED" ? "2026-11-24T10:00:00Z" : null,
    createdAt: "2026-11-23T10:00:00Z",
  };
}

/** Renders /brand/products with both queries already answered (no network in the test). */
function render(state: ProfileState, products: BrandCard[]): string {
  const client = new QueryClient();
  client.setQueryData(brandProfileQueryKey, profile(state));
  client.setQueryData(brandProductsKey, products);
  return renderToString(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/brand/products"]}>
        <BrandProductsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The <button> elements with the publish text, as HTML strings. */
function publishButtons(html: string): string[] {
  return [
    ...html.matchAll(/<button[^>]*>Опублікувати у стрічку<\/button>/g),
  ].map((match) => match[0]);
}

describe("/brand/products: publishing (US-31)", () => {
  it("offers an active publish button for a draft of a CONSENTED brand", () => {
    const html = render("CONSENTED", [card("1", "DRAFT")]);
    const buttons = publishButtons(html);
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).not.toContain("disabled");
    expect(html).not.toContain(messages.CONSENT_REQUIRED);
  });

  it("blocks the button and shows the consent hint without consent (US-31 S2)", () => {
    const html = render("ACTIVE", [card("1", "DRAFT")]);
    const buttons = publishButtons(html);
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toContain("disabled");
    expect(buttons[0]).toContain('aria-describedby="publish-consent-hint"');
    expect(html).toContain('id="publish-consent-hint"');
    expect(html).toContain(messages.CONSENT_REQUIRED);
    expect(html).toMatch(/<a[^>]*href="\/brand\/profile"[^>]*>/);
  });

  it("shows «Опубліковано» and no button for a PUBLISHED card (US-31 S1)", () => {
    const html = render("CONSENTED", [card("1", "PUBLISHED")]);
    expect(html).toContain("Опубліковано");
    expect(publishButtons(html)).toHaveLength(0);
  });

  it("shows no consent hint when there are no drafts", () => {
    const html = render("ACTIVE", [card("1", "PUBLISHED")]);
    expect(html).not.toContain(messages.CONSENT_REQUIRED);
    expect(publishButtons(html)).toHaveLength(0);
  });
});
