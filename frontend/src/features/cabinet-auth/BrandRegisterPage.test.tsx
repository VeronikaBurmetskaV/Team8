import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "../../api/client";
import {
  brandNameInvalidMessage,
  messages,
  websiteUrlInvalidMessage,
} from "../../shared/messages.uk";
import { LoginPage } from "../buyer-auth/LoginPage";
import { BrandRegisterPage } from "./BrandRegisterPage";
import { brandRegisterErrors } from "./registerErrors";

function render(element: React.ReactNode, url = "/") {
  return renderToString(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[url]}>{element}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("/brand/register", () => {
  const html = render(<BrandRegisterPage />, "/brand/register");

  it("has the four fields in form order with labels", () => {
    const order = ["brand-name", "brand-website", "email", "password"].map(
      (id) => html.indexOf(`for="${id}"`),
    );
    expect(order.every((index) => index > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain(">Назва бренду<");
    expect(html).toContain(">Сайт бренду<");
    expect(html).toContain('placeholder="https://brand.com.ua"');
    // the password has the eye toggle
    expect(html).toContain('aria-controls="password"');
  });

  it("centres the title over the card and keeps «Увійти» inside the card", () => {
    expect(html).toMatch(
      /<h1 class="[^"]*_titleCentered[^"]*">Реєстрація бренду<\/h1>/,
    );
    const card = html.slice(html.search(/<div class="[^"]*_card/));
    expect(card).toMatch(
      /Вже маєте кабінет\?.*<a[^>]*href="\/login\?tab=brand"[^>]*>Увійти<\/a>/s,
    );
    expect(html).toMatch(
      /<button[^>]*type="submit"[^>]*>Зареєструвати бренд<\/button>/,
    );
  });
});

describe("server errors on /brand/register", () => {
  it("puts PROFILE_INVALID under the name or the website with their own hints", () => {
    const error = new ApiError(400, "PROFILE_INVALID", {
      name: "PROFILE_INVALID",
      websiteUrl: "PROFILE_INVALID",
      password: "PASSWORD_TOO_SHORT",
    });
    expect(brandRegisterErrors(error)).toEqual({
      fields: {
        name: brandNameInvalidMessage,
        websiteUrl: websiteUrlInvalidMessage,
        password: messages.PASSWORD_TOO_SHORT,
      },
      form: null,
    });
  });

  it("puts a taken email (409) under «Email» and other errors once for the form", () => {
    expect(
      brandRegisterErrors(
        new ApiError(409, "EMAIL_TAKEN_OR_INVALID", {
          email: "EMAIL_TAKEN_OR_INVALID",
        }),
      ),
    ).toEqual({
      fields: { email: messages.EMAIL_TAKEN_OR_INVALID },
      form: null,
    });
    expect(brandRegisterErrors(new ApiError(429, "TOO_MANY_REQUESTS"))).toEqual(
      {
        fields: {},
        form: messages.TOO_MANY_REQUESTS,
      },
    );
  });
});

// The green colour itself is checked in the browser (computed styles); Vitest does not load CSS.
describe("tabs on /login", () => {
  it("marks the active tab with aria-selected", () => {
    const html = render(<LoginPage />, "/login?tab=brand");
    const tab = (id: string) =>
      html.match(new RegExp(`<button[^>]*id="${id}"[^>]*>`))?.[0] ?? "";
    expect(tab("login-tab-brand")).toContain('aria-selected="true"');
    expect(tab("login-tab-buyer")).toContain('aria-selected="false"');
  });
});
