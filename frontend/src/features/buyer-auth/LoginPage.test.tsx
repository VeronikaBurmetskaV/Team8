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

  it("shows the buyer placeholder without a form on the default tab", () => {
    const html = render("/login");
    expect(html).toContain("Тут скоро буде вхід для покупця");
    expect(html).not.toContain("<form");
    expect(html).not.toContain('type="password"');
    // «Створити» is not a link yet: there is no buyer registration page.
    expect(html).toContain("Створити");
    expect(html).not.toContain('href="/register"');
  });

  it("opens the brand tab for ?tab=brand", () => {
    const html = render("/login?tab=brand");
    expect(tabTag(html, "login-tab-brand")).toContain('aria-selected="true"');
    expect(tabTag(html, "login-tab-brand")).toContain('tabindex="0"');
    expect(tabTag(html, "login-tab-buyer")).toContain('tabindex="-1"');
    expect(html).toContain('type="password"');
    expect(html).not.toContain("Тут скоро буде вхід для покупця");
  });

  it("links the brand tab to /brand/register", () => {
    const html = render("/login?tab=brand");
    expect(html).toMatch(
      /<a[^>]*href="\/brand\/register"[^>]*>Зареєструвати бренд<\/a>/,
    );
  });
});
