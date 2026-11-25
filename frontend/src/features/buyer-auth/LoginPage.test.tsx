import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { LoginPage } from "./LoginPage";

function render(path: string): string {
  return renderToString(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The opening tag of the tab with this id, to read its ARIA attributes. */
function tabTag(html: string, id: string): string {
  const match = html.match(new RegExp(`<button[^>]*id="${id}"[^>]*>`));
  if (!match) throw new Error(`no tab ${id}`);
  return match[0];
}

describe("/login", () => {
  it("renders an accessible tablist with both tabs", () => {
    const html = render("/login");
    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain("Вхід для бренду");
    expect(tabTag(html, "login-tab-buyer")).toContain('aria-selected="true"');
    expect(tabTag(html, "login-tab-brand")).toContain('aria-selected="false"');
  });

  it("shows the buyer login form on the default tab", () => {
    const html = render("/login");
    expect(html).not.toContain("Тут скоро буде вхід для покупця");
    expect(html).toContain("<form");
    expect(html).toMatch(/<label[^>]*for="buyer-email"[^>]*>Email<\/label>/);
    expect(html).toMatch(
      /<label[^>]*for="buyer-password"[^>]*>Пароль<\/label>/,
    );
    expect(html).toMatch(
      /<input[^>]*id="buyer-email"[^>]*autoComplete="email"/i,
    );
    expect(html).toMatch(/<input[^>]*autoComplete="current-password"[^>]*>/i);
    expect(html).toContain('type="password"');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Увійти<\/button>/);
  });

  it("has an eye toggle for the password", () => {
    const html = render("/login");
    const eye = html.match(/<button[^>]*aria-label="Показати пароль"[^>]*>/);
    expect(eye?.[0]).toContain('aria-pressed="false"');
    expect(eye?.[0]).toContain('aria-controls="buyer-password"');
    expect(eye?.[0]).toContain('type="button"');
  });

  it("links the buyer tab to /register", () => {
    const html = render("/login");
    expect(html).toMatch(/<a[^>]*href="\/register"[^>]*>Зареєструватися<\/a>/);
  });

  it("keeps empty live regions for the common messages", () => {
    const html = render("/login");
    expect(html).toContain('role="status"');
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("скоро запрацює");
  });

  it("draws the green line only under the active tab", () => {
    for (const [url, active, inactive] of [
      ["/login", "login-tab-buyer", "login-tab-brand"],
      ["/login?tab=brand", "login-tab-brand", "login-tab-buyer"],
    ] as const) {
      const html = render(url);
      const tab = (id: string) =>
        html.match(
          new RegExp(`<button[^>]*id="${id}"[^>]*>.*?</button>`),
        )?.[0] ?? "";
      expect(tab(active)).toMatch(
        /<span[^>]*class="[^"]*_tabLine[^"]*"[^>]*aria-hidden="true"/,
      );
      expect(tab(inactive)).not.toContain("_tabLine");
    }
  });

  it("opens the brand tab for ?tab=brand", () => {
    const html = render("/login?tab=brand");
    expect(tabTag(html, "login-tab-brand")).toContain('aria-selected="true"');
    expect(tabTag(html, "login-tab-brand")).toContain('tabindex="0"');
    expect(tabTag(html, "login-tab-buyer")).toContain('tabindex="-1"');
    expect(html).toContain('id="brand-password"');
    expect(html).not.toContain('id="buyer-email"');
  });

  it("links the brand tab to /brand/register", () => {
    const html = render("/login?tab=brand");
    expect(html).toMatch(
      /<a[^>]*href="\/brand\/register"[^>]*>Зареєструвати бренд<\/a>/,
    );
  });
});
