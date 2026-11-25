import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type { BrandCard, BrandProfileResponse } from "../../api/types";
import {
  brandProfileQueryKey,
  toBrandProfile,
} from "../../shared/brandProfile";
import { brandProductsKey } from "../cabinet-products/queries";
import { BrandHomePage } from "./BrandHomePage";
import { homeNotices, summarizeProducts, websiteLink } from "./cabinetHome";

const consentedProfile: BrandProfileResponse = {
  name: "Тестовий бренд",
  websiteUrl: "https://lileya.com.ua/",
  logoImageId: null,
  logoUrl: null,
  logoDisplayUrl: null,
  consentGiven: true,
  consentGivenAt: "2026-11-24T10:00:00Z",
  consentText: "Згода",
  state: "CONSENTED",
};

const activeProfile: BrandProfileResponse = {
  ...consentedProfile,
  consentGiven: false,
  consentGivenAt: null,
  consentText: null,
  state: "ACTIVE",
};

const incompleteProfile: BrandProfileResponse = {
  ...activeProfile,
  name: null,
  state: "INCOMPLETE",
};

function card(id: string, status: BrandCard["status"]): BrandCard {
  return { id, status } as BrandCard;
}

/** Renders /brand with the given answers already in the cache (no network in the test). */
function render(
  profile: BrandProfileResponse | undefined,
  products: BrandCard[] | undefined,
): string {
  const client = new QueryClient();
  if (profile) client.setQueryData(brandProfileQueryKey, profile);
  if (products) client.setQueryData(brandProductsKey, products);
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
const CONSENT_NOTICE = "Покупці поки не бачать ваших товарів";
const NAME_NOTICE = "Спочатку збережіть назву бренду в профілі";

describe("/brand: the profile header", () => {
  it("is a section labelled by the brand name heading", () => {
    const html = render(consentedProfile, []);
    const id = html.match(/<section[^>]*aria-labelledby="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(html).toMatch(
      new RegExp(`<h2[^>]*id="${id}"[^>]*>Тестовий бренд</h2>`),
    );
    // the old square card and its «Ще не вказана» are gone
    expect(html).not.toContain("Ще не вказана");
  });

  it("shows «Назва не вказана» and «Додати назву» when there is no name", () => {
    const html = render(incompleteProfile, []);
    expect(html).toMatch(/<h2[^>]*>Назва не вказана<\/h2>/);
    expect(html).toMatch(link("/brand/profile", "Додати назву"));
  });

  it("shows a round monogram when there is no logo", () => {
    const html = render(consentedProfile, []);
    expect(html).toMatch(/<span[^>]*_monogram[^>]*>ТБ<\/span>/);
    expect(html).not.toContain("<img");
  });

  it("shows the logo instead of the monogram when there is one", () => {
    const html = render(
      { ...consentedProfile, logoDisplayUrl: "/api/images/1" },
      [],
    );
    expect(html).toMatch(
      /<img[^>]*src="\/api\/images\/1"[^>]*alt="Логотип Тестовий бренд"/,
    );
    expect(html).not.toContain("_monogram");
  });

  it("links to the website in a new tab, with utm_source", () => {
    const html = render(consentedProfile, []);
    expect(html).toMatch(
      /<a[^>]*href="https:\/\/lileya.com.ua\/\?utm_source=fulla"[^>]*target="_blank"[^>]*rel="noopener noreferrer"[^>]*>lileya.com.ua<\/a>/,
    );
  });

  it("links to the profile editor", () => {
    expect(render(consentedProfile, [])).toMatch(
      link("/brand/profile", "Редагувати профіль"),
    );
  });
});

describe("/brand: notices", () => {
  it("consent given: the date, no notice", () => {
    const html = render(consentedProfile, []);
    expect(html).toContain("Згоду надано 24.11.2026");
    expect(html).not.toContain(CONSENT_NOTICE);
    expect(html).not.toContain(NAME_NOTICE);
    expect(html).not.toContain('role="status"');
  });

  it("no consent: a status notice with «Підтвердити згоду» → /brand/profile#consent", () => {
    const html = render(activeProfile, []);
    expect(html).toContain("Згоду не надано");
    expect(html).toMatch(
      new RegExp(`<div[^>]*role="status"[^>]*>.*${CONSENT_NOTICE}`),
    );
    expect(html).toMatch(link("/brand/profile#consent", "Підтвердити згоду"));
    expect(html).not.toContain(NAME_NOTICE);
  });

  it("no name: only the name notice (consent cannot be given without it)", () => {
    const html = render(incompleteProfile, []);
    expect(html).toMatch(new RegExp(`role="status"[^>]*>.*${NAME_NOTICE}`));
    expect(html).not.toContain(CONSENT_NOTICE);
  });

  it("homeNotices follows the same rules", () => {
    expect(homeNotices(consentedProfile)).toEqual({
      needsName: false,
      needsConsent: false,
    });
    expect(homeNotices(activeProfile)).toEqual({
      needsName: false,
      needsConsent: true,
    });
    expect(homeNotices(incompleteProfile)).toEqual({
      needsName: true,
      needsConsent: false,
    });
  });
});

describe("/brand: products", () => {
  it("«Додати товар» leads to the new product form when the name is saved", () => {
    const html = render(activeProfile, [card("1", "PUBLISHED")]);
    expect(html).toMatch(link("/brand/products/new", "Додати товар"));
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>Додати товар/);
  });

  it("no name: «Додати товар» is a disabled button with a hint", () => {
    const html = render(incompleteProfile, []);
    expect(html).not.toContain('href="/brand/products/new"');
    const button = html.match(/<button[^>]*>Додати товар<\/button>/)?.[0] ?? "";
    expect(button).toMatch(/disabled=""/);
    const hintId = button.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(html).toMatch(
      new RegExp(
        `<p[^>]*id="${hintId}"[^>]*>Щоб додати товар, спершу збережіть назву бренду</p>`,
      ),
    );
  });

  it("counts all, published and draft products", () => {
    const html = render(consentedProfile, [
      card("1", "PUBLISHED"),
      card("2", "DRAFT"),
      card("3", "DRAFT"),
    ]);
    expect(html).toMatch(/Усього<\/dt><dd>3</);
    expect(html).toMatch(/Опубліковано<\/dt><dd>1</);
    expect(html).toMatch(/Чернетки<\/dt><dd>2</);
    expect(html).not.toContain("У вас поки немає товарів");
    expect(summarizeProducts([card("1", "DRAFT")])).toEqual({
      total: 1,
      published: 0,
      drafts: 1,
    });
  });

  it("no products: the friendly empty text", () => {
    expect(render(consentedProfile, [])).toContain(
      "У вас поки немає товарів. Додайте перший — це займе кілька хвилин.",
    );
  });

  it("links to all products", () => {
    expect(render(consentedProfile, [])).toMatch(
      link("/brand/products", "Усі товари"),
    );
  });

  it("while loading: skeletons, no counts", () => {
    const html = render(undefined, undefined);
    expect(html).toContain("_skeleton");
    expect(html).not.toContain("<dd>");
  });
});

describe("websiteLink", () => {
  it("shows the host without https:// and the trailing slash", () => {
    expect(websiteLink("https://lileya.com.ua/")).toEqual({
      href: "https://lileya.com.ua/?utm_source=fulla",
      text: "lileya.com.ua",
    });
    expect(websiteLink(null)).toBeNull();
  });
});

describe("websiteLink: a missing or wrong website gives no link", () => {
  it.each([undefined, null, "", "  ", "http://lileya.com.ua"])(
    "%j → null, without an exception",
    (value) => {
      expect(websiteLink(value)).toBeNull();
    },
  );

  it("only https:// gives a link", () => {
    expect(websiteLink("  https://lileya.com.ua  ")).toEqual({
      href: "https://lileya.com.ua?utm_source=fulla",
      text: "lileya.com.ua",
    });
  });
});

describe("/brand with a profile answer that has no websiteUrl (a backend from before 2026-11-26)", () => {
  // The exact answer of the stale dev backend: no `websiteUrl` key at all.
  const oldAnswer = {
    name: "Тестовий бренд",
    logoImageId: null,
    logoUrl: null,
    consentGiven: false,
    logoDisplayUrl: null,
    consentGivenAt: null,
    consentText: null,
    state: "ACTIVE",
  };

  it("toBrandProfile turns the missing key into null", () => {
    expect(toBrandProfile(oldAnswer).websiteUrl).toBeNull();
    expect(toBrandProfile({}).state).toBe("INCOMPLETE");
    expect(toBrandProfile(null).name).toBeNull();
  });

  it("renders without a website link (normalized and even raw)", () => {
    for (const profile of [
      toBrandProfile(oldAnswer),
      oldAnswer as unknown as BrandProfileResponse,
    ]) {
      const html = render(profile, []);
      expect(html).toMatch(/<h2[^>]*>Тестовий бренд<\/h2>/);
      expect(html).not.toContain('target="_blank"');
    }
  });
});
