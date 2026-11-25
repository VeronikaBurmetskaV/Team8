import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { buyerAuthTexts, forgotPasswordTexts } from "../../shared/messages.uk";
import { forgotPasswordSchemas } from "../../shared/validation";
import { ForgotPasswordCard, ForgotPasswordPage } from "./ForgotPasswordPage";
import { LoginPage } from "./LoginPage";
import { forgotPasswordPath, parseResetFor, type LoginTab } from "./loginTabs";
import { requestPasswordReset } from "./passwordReset";

afterEach(() => {
  vi.unstubAllGlobals();
});

function render(element: React.ReactNode, url: string): string {
  return renderToString(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[url]}>{element}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const STUB =
  "Скоро тут можна буде отримати лист для відновлення пароля. Поки що зверніться до команди FULLA.";

describe("«Забули пароль?» on /login", () => {
  it.each([
    ["/login", "/forgot-password?for=buyer", "buyer-password"],
    ["/login?tab=brand", "/forgot-password?for=brand", "brand-password"],
  ])("%s: a link under the password to %s", (url, href, passwordId) => {
    const html = render(<LoginPage />, url);
    const link = html.match(/<a[^>]*>Забули пароль\?<\/a>/)?.[0] ?? "";
    // a real link: reachable with Tab and opened with Enter
    expect(link).toContain(`href="${href}"`);
    expect(link).toMatch(/class="[^"]*_forgotLink/);
    // after the password field, before the submit button
    const password = html.indexOf(`id="${passwordId}"`);
    const forgot = html.indexOf("Забули пароль?");
    const submit = html.indexOf('type="submit"');
    expect(password).toBeGreaterThan(0);
    expect(forgot).toBeGreaterThan(password);
    expect(submit).toBeGreaterThan(forgot);
  });

  it("builds and reads the address of each tab", () => {
    for (const tab of ["buyer", "brand"] as const) {
      const search = new URL(forgotPasswordPath(tab), "http://x").searchParams;
      expect(parseResetFor(search)).toBe(tab);
    }
    expect(parseResetFor(new URLSearchParams(""))).toBe("buyer");
    expect(parseResetFor(new URLSearchParams("?for=admin"))).toBe("buyer");
  });
});

describe("/forgot-password before «Надіслати»", () => {
  it("brand: title, intro, «Email», «Надіслати» and the way back", () => {
    const html = render(<ForgotPasswordPage />, "/forgot-password?for=brand");
    expect(html).toMatch(/<h1[^>]*>Відновлення пароля<\/h1>/);
    expect(html).toContain("Введіть пошту, яку ви вказували при реєстрації");
    expect(html).toMatch(/<label[^>]*for="forgot-login"[^>]*>Email<\/label>/);
    const input = html.match(/<input[^>]*id="forgot-login"[^>]*>/)?.[0] ?? "";
    expect(input).toContain('type="email"');
    expect(input).toMatch(/autoComplete="email"/i);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Надіслати<\/button>/);
    expect(html).toMatch(
      /<a[^>]*href="\/login\?tab=brand"[^>]*>Повернутися до входу<\/a>/,
    );
    // the live region is already there, still empty
    expect(html).toMatch(/<div role="status"[^>]*><\/div>/);
    expect(html).not.toContain(STUB);
  });

  it("buyer: «Email або номер телефону» and the way back to /login", () => {
    const html = render(<ForgotPasswordPage />, "/forgot-password?for=buyer");
    expect(html).toMatch(
      /<label[^>]*for="forgot-login"[^>]*>Email або номер телефону<\/label>/,
    );
    const input = html.match(/<input[^>]*id="forgot-login"[^>]*>/)?.[0] ?? "";
    expect(input).toContain('type="text"');
    expect(html).toMatch(
      /<a[^>]*href="\/login"[^>]*>Повернутися до входу<\/a>/,
    );
  });
});

describe("/forgot-password after «Надіслати»", () => {
  it.each([
    ["buyer", "/login"],
    ["brand", "/login?tab=brand"],
  ] as const)(
    "%s: the stub in role=status and «Повернутися до входу» → %s",
    (audience: LoginTab, loginHref) => {
      const html = render(
        <ForgotPasswordCard
          audience={audience}
          sent={true}
          onSent={() => undefined}
        />,
        "/forgot-password",
      );
      expect(html).toMatch(
        new RegExp(`<div role="status"[^>]*><p[^>]*>${STUB}</p></div>`),
      );
      expect(forgotPasswordTexts.sent).toBe(STUB);
      // the form is gone; the main green button leads back to the right tab
      expect(html).not.toContain("<form");
      const links = html.match(/<a[^>]*>Повернутися до входу<\/a>/g) ?? [];
      expect(links).toHaveLength(1);
      expect(links[0]).toContain(`href="${loginHref}"`);
      expect(links[0]).toMatch(/class="[^"]*_linkButton/);
    },
  );

  it("sends nothing to the server", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(
      requestPasswordReset({ for: "brand", login: "info@brand.ua" }),
    ).resolves.toEqual({ status: "soon" });
    await expect(
      requestPasswordReset({ for: "buyer", login: "0671234567" }),
    ).resolves.toEqual({ status: "soon" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("the field of /forgot-password", () => {
  const options = { fields: {}, shouldUseNativeValidation: false } as const;

  it.each([
    ["brand", "", buyerAuthTexts.emailRequired],
    ["brand", "no-at-sign", buyerAuthTexts.emailInvalid],
    ["brand", "0671234567", buyerAuthTexts.emailInvalid],
    ["buyer", "  ", buyerAuthTexts.loginRequired],
    ["buyer", "12345", buyerAuthTexts.loginInvalid],
  ] as const)(
    "%s %j: an error and «Надіслати» does nothing",
    async (audience, login, message) => {
      // react-hook-form calls onSubmit only when the resolver has no errors
      const result = await zodResolver(forgotPasswordSchemas[audience])(
        { login },
        undefined,
        options,
      );
      expect(result.errors.login?.message).toBe(message);
      expect(result.values).toEqual({});
    },
  );

  it.each([
    ["brand", " Info@Brand.UA ", "info@brand.ua"],
    ["buyer", "buyer@mail.com", "buyer@mail.com"],
    ["buyer", "067 123 45 67", "067 123 45 67"],
  ] as const)("%s %j passes", async (audience, login, value) => {
    const result = await zodResolver(forgotPasswordSchemas[audience])(
      { login },
      undefined,
      options,
    );
    expect(result.errors).toEqual({});
    expect(result.values).toEqual({ login: value });
  });
});
