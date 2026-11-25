import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "../../api/client";
import { messages } from "../../shared/messages.uk";
import { brandLoginSchema, buyerLoginSchema } from "../../shared/validation";
import { buyerLoginBody, loginBuyer } from "./api";
import { LoginPage } from "./LoginPage";
import { Link } from "react-router";
import { FieldError } from "../../shared/auth/FormMessage";
import { loginError, registerPath, showLoginError } from "./loginTabs";

afterEach(() => {
  vi.unstubAllGlobals();
});

function render(url: string): string {
  return renderToString(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[url]}>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const input = (html: string, id: string) =>
  html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))?.[0] ?? "";

describe("the name field on /login (2026-12-02)", () => {
  it("«Вхід»: «Ваше імʼя» first, above «Email», autocomplete given-name", () => {
    const html = render("/login");
    expect(html).toMatch(/<label[^>]*for="buyer-name"[^>]*>Ваше імʼя<\/label>/);
    expect(input(html, "buyer-name")).toMatch(/autoComplete="given-name"/i);
    expect(input(html, "buyer-name")).toContain('type="text"');
    expect(html.indexOf('for="buyer-name"')).toBeLessThan(
      html.indexOf('for="buyer-email"'),
    );
    // first field of the form
    expect(html.slice(html.indexOf("<form"))).toMatch(
      /^<form[^>]*><div[^>]*><label[^>]*for="buyer-name"/,
    );
  });

  it("«Вхід для бренду»: «Назва бренду» first, above «Email», autocomplete organization", () => {
    const html = render("/login?tab=brand");
    expect(html).toMatch(
      /<label[^>]*for="brand-login-name"[^>]*>Назва бренду<\/label>/,
    );
    expect(input(html, "brand-login-name")).toMatch(
      /autoComplete="organization"/i,
    );
    expect(html.slice(html.indexOf("<form"))).toMatch(
      /^<form[^>]*><div[^>]*><label[^>]*for="brand-login-name"/,
    );
    expect(html.indexOf('for="brand-login-name"')).toBeLessThan(
      html.indexOf('for="brand-email"'),
    );
    // the rest stays: «Забули пароль?» and the button
    expect(html).toContain("Забули пароль?");
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Увійти<\/button>/);
  });

  it("both fields use the same field wrapper as email and password", () => {
    for (const [url, name, email] of [
      ["/login", "buyer-name", "buyer-email"],
      ["/login?tab=brand", "brand-login-name", "brand-email"],
    ] as const) {
      const html = render(url);
      const wrapper = (id: string) =>
        html.match(
          new RegExp(`<div class="([^"]*)"><label[^>]*for="${id}"`),
        )?.[1];
      expect(wrapper(name)).toBeDefined();
      expect(wrapper(name)).toBe(wrapper(email));
    }
  });
});

describe("an empty name: an error, and nothing is sent", () => {
  const options = { fields: {}, shouldUseNativeValidation: false } as const;

  it.each(["", "   "])(
    "brand name %j → «Введіть назву бренду»",
    async (brandName) => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
      // react-hook-form calls onSubmit (and so useLoginBrand) only when the resolver has no errors
      const result = await zodResolver(brandLoginSchema)(
        { brandName, email: "info@brand.ua", password: "secret-123" },
        undefined,
        options,
      );
      expect(result.errors.brandName?.message).toBe("Введіть назву бренду");
      expect(result.values).toEqual({});
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it.each(["", "   "])("buyer name %j → «Введіть імʼя»", async (name) => {
    const result = await zodResolver(buyerLoginSchema)(
      { name, email: "buyer@mail.com", password: "password1" },
      undefined,
      options,
    );
    expect(result.errors.name?.message).toBe("Введіть імʼя");
    expect(result.values).toEqual({});
  });
});

describe("the buyer's future login request", () => {
  it("carries the trimmed name; today nothing is sent at all", async () => {
    const credentials = {
      name: "  Софія ",
      email: "buyer@mail.com",
      password: "password1",
    };
    expect(buyerLoginBody(credentials)).toEqual({
      name: "Софія",
      email: "buyer@mail.com",
      password: "password1",
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(loginBuyer(credentials)).resolves.toEqual({ status: "soon" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("server errors on /login go under their field (ADR-0018)", () => {
  const cases = [
    ["brand", "EMAIL_NOT_FOUND", "email", "Акаунт з такою поштою не знайдено"],
    ["brand", "WRONG_PASSWORD", "password", "Неправильний пароль"],
    [
      "brand",
      "BRAND_NAME_MISMATCH",
      "brandName",
      "Назва бренду не збігається з вказаною при реєстрації",
    ],
    ["buyer", "EMAIL_NOT_FOUND", "email", "Акаунт з такою поштою не знайдено"],
    ["buyer", "WRONG_PASSWORD", "password", "Неправильний пароль"],
    [
      "buyer",
      "NAME_MISMATCH",
      "name",
      "Імʼя не збігається з вказаним при реєстрації",
    ],
  ] as const;

  it.each(cases)(
    "%s %s → under «%s», with the focus there",
    (tab, code, field, text) => {
      const error = new ApiError(401, code, { [field]: code });
      expect(loginError(error, tab)).toEqual({ field, code, message: text });
      const setError = vi.fn();
      showLoginError(error, tab, setError);
      expect(setError).toHaveBeenCalledTimes(1);
      expect(setError).toHaveBeenCalledWith(
        field,
        { type: code, message: text },
        { shouldFocus: true },
      );
    },
  );

  it("429: «Забагато спроб. Спробуйте за кілька хвилин» once for the form", () => {
    const setError = vi.fn();
    showLoginError(new ApiError(429, "TOO_MANY_REQUESTS"), "brand", setError);
    expect(setError).toHaveBeenCalledWith("root", {
      type: "TOO_MANY_REQUESTS",
      message: "Забагато спроб. Спробуйте за кілька хвилин",
    });
  });

  it("anything unexpected: its own text once for the form, never «Неправильні дані для входу»", () => {
    expect(loginError(new TypeError("Failed to fetch"), "buyer")).toEqual({
      field: null,
      code: "SERVICE_UNAVAILABLE",
      message: messages.SERVICE_UNAVAILABLE,
    });
    expect(
      Object.values(messages).some((text) =>
        text.startsWith("Неправильні дані для входу"),
      ),
    ).toBe(false);
  });
});

describe("the ways out next to the errors", () => {
  it("«Зареєструватися» right after «Акаунт з такою поштою не знайдено», inside the error", () => {
    for (const tab of ["buyer", "brand"] as const) {
      const html = renderToString(
        <MemoryRouter>
          <FieldError
            id="email-error"
            message={messages.EMAIL_NOT_FOUND}
            action={<Link to={registerPath(tab)}>Зареєструватися</Link>}
          />
        </MemoryRouter>,
      );
      expect(html).toMatch(
        new RegExp(
          `<p id="email-error"[^>]*>Акаунт з такою поштою не знайдено(<!-- -->)? <a[^>]*href="${registerPath(tab)}"[^>]*>Зареєструватися</a></p>`,
        ),
      );
    }
    expect(registerPath("brand")).toBe("/brand/register");
    expect(registerPath("buyer")).toBe("/register");
  });

  it("«Забули пароль?» sits right under the password field, where «Неправильний пароль» appears", () => {
    for (const [url, id] of [
      ["/login", "buyer-password"],
      ["/login?tab=brand", "brand-password"],
    ] as const) {
      const html = render(url);
      const password = html.indexOf(`id="${id}"`);
      const forgot = html.indexOf("Забули пароль?");
      // only the eye button lies between them; the error <p> is rendered in that gap
      const between = html.slice(password, forgot);
      expect(between).not.toContain("<input");
      expect(between).toContain('aria-controls="' + id + '"');
    }
  });

  it("the email and password inputs are ready for aria-invalid / aria-describedby", () => {
    const html = render("/login?tab=brand");
    // no error yet: neither attribute, so screen readers say nothing extra
    expect(input(html, "brand-email")).not.toContain("aria-invalid");
    expect(input(html, "brand-password")).not.toContain("aria-invalid");
  });
});
