import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createStaticHandler,
  createStaticRouter,
  MemoryRouter,
  StaticRouterProvider,
  type RouteObject,
} from "react-router";
import { routes } from "../routes";
import { errorDetails, RouteErrorView } from "./RouteError";

/** The app's routes, with the page at `path` throwing when it is opened. */
function withThrowingPage(list: RouteObject[], path: string): RouteObject[] {
  return list.map((route) => {
    if (route.path === path) {
      return {
        ...route,
        loader: () => {
          throw new Error("boom");
        },
      } as RouteObject;
    }
    return route.children
      ? ({
          ...route,
          children: withThrowingPage(route.children, path),
        } as RouteObject)
      : route;
  });
}

/** Renders the real route tree at `url` on the server (no DOM in the tests). */
async function renderAt(path: string): Promise<string> {
  const handler = createStaticHandler(withThrowingPage(routes, path));
  const context = await handler.query(new Request(`http://localhost${path}`));
  if (context instanceof Response) throw new Error("unexpected redirect");
  const router = createStaticRouter(handler.dataRoutes, context);
  return renderToString(
    <QueryClientProvider client={new QueryClient()}>
      <StaticRouterProvider router={router} context={context} hydrate={false} />
    </QueryClientProvider>,
  );
}

describe("errorElement: one broken page does not take the site down", () => {
  it("a buyer page that throws shows «Щось пішло не так» with the header kept", async () => {
    const html = await renderAt("/favorites");
    expect(html).toContain("Щось пішло не так");
    expect(html).toMatch(/<button[^>]*>Спробувати ще раз<\/button>/);
    expect(html).toMatch(/<a[^>]*href="\/"[^>]*>На головну<\/a>/);
    // the page sits inside the layout: the site header is still there
    expect(html).toContain("<header");
  });

  it("a cabinet page that throws leads back to the cabinet", async () => {
    const html = await renderAt("/brand");
    expect(html).toContain("Щось пішло не так");
    expect(html).toMatch(/<a[^>]*href="\/brand"[^>]*>До кабінету<\/a>/);
    expect(html).not.toContain(">На головну<");
    expect(html).toContain('class="layout-header"');
  });
});

describe("RouteErrorView", () => {
  const view = (details: string | null) =>
    renderToString(
      <MemoryRouter>
        <RouteErrorView area="site" onRetry={() => {}} details={details} />
      </MemoryRouter>,
    );

  it("shows the error text only when given (development)", () => {
    expect(view("Error: boom")).toContain("Error: boom");
    expect(view(null)).not.toContain("<details");
  });

  it("errorDetails is null outside development", () => {
    expect(errorDetails(new Error("boom"), false)).toBeNull();
    expect(errorDetails(new Error("boom"), true)).toContain("boom");
    expect(errorDetails({ status: 404, statusText: "Not Found" }, true)).toBe(
      "404 Not Found",
    );
  });
});
