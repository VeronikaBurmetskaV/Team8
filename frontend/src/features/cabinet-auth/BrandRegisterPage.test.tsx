import { afterEach, describe, expect, it, vi } from "vitest";
import { zodResolver } from "@hookform/resolvers/zod";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "../../api/client";
import {
  brandNameInvalidMessage,
  buyerAuthTexts,
  messages,
  websiteUrlInvalidMessage,
} from "../../shared/messages.uk";
import { LoginPage } from "../buyer-auth/LoginPage";
import { BrandRegisterPage } from "./BrandRegisterPage";
import { brandRegisterSchema } from "../../shared/validation";
import { brandRegisterErrors } from "./registerErrors";

afterEach(() => {
  vi.unstubAllGlobals();
});

function render(element: React.ReactNode, url = "/") {
  return renderToString(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[url]}>{element}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("/brand/register", () => {
  const html = render(<BrandRegisterPage />, "/brand/register");

  it("has the five fields in form order with labels, «Ваше імʼя» first", () => {
    const order = [
      "brand-contact-name",
      "brand-name",
      "brand-website",
      "email",
      "password",
    ].map((id) => html.indexOf(`for="${id}"`));
    expect(order.every((index) => index > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toMatch(
      /<label[^>]*for="brand-contact-name"[^>]*>Ваше імʼя<\/label>/,
    );
    expect(html).toMatch(
      /<input[^>]*id="brand-contact-name"[^>]*autoComplete="name"/i,
    );
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

describe("«Ваше імʼя» is required: nothing is sent without it", () => {
  const resolver = zodResolver(brandRegisterSchema);
  const options = { fields: {}, shouldUseNativeValidation: false } as const;
  const form = {
    name: "Lileya",
    websiteUrl: "https://lileya.com.ua",
    email: "info@lileya.com.ua",
    password: "secret-123",
  };

  it.each(["", "   ", "\u00A0"])(
    "contact name %j: «Введіть імʼя» and no request",
    async (contactName) => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
      // react-hook-form calls onSubmit (the only caller of useRegisterBrand) only when the
      // resolver returns no errors
      const result = await resolver(
        { ...form, contactName },
        undefined,
        options,
      );
      expect(result.errors.contactName?.message).toBe("Введіть імʼя");
      expect(result.values).toEqual({});
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it("longer than 50: the length hint", async () => {
    const result = await resolver(
      { ...form, contactName: "я".repeat(51) },
      undefined,
      options,
    );
    expect(result.errors.contactName?.message).toBe(buyerAuthTexts.nameInvalid);
  });

  it("a name passes trimmed, and is sent first in the request", async () => {
    const result = await resolver(
      { ...form, contactName: "  Олена Коваль " },
      undefined,
      options,
    );
    expect(result.errors).toEqual({});
    expect(result.values).toMatchObject({ contactName: "Олена Коваль" });
    expect(Object.keys(result.values)[0]).toBe("contactName");
  });
});

describe("server errors on /brand/register", () => {
  it("puts VALIDATION_FAILED on contactName under «Ваше імʼя»", () => {
    const error = new ApiError(400, "VALIDATION_FAILED", {
      contactName: "VALIDATION_FAILED",
    });
    expect(brandRegisterErrors(error)).toEqual({
      fields: { contactName: buyerAuthTexts.nameInvalid },
      form: null,
    });
  });

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
