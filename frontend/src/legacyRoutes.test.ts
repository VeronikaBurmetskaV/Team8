import { describe, expect, it } from "vitest";
import { createMemoryRouter } from "react-router";
import { legacyRoutes } from "./legacyRoutes";

async function landing(from: string) {
  const router = createMemoryRouter(
    [
      ...legacyRoutes,
      { path: "/favorites", element: null },
      { path: "/login", element: null },
    ],
    { initialEntries: [from] },
  );
  router.initialize();
  await new Promise<void>((resolve) => {
    if (router.state.initialized) resolve();
    else
      router.subscribe((state) => {
        if (state.initialized) resolve();
      });
  });
  const { pathname, search } = router.state.location;
  router.dispose();
  return pathname + search;
}

describe("old addresses", () => {
  it("/swipe-favorites redirects to /favorites", async () => {
    expect(await landing("/swipe-favorites")).toBe("/favorites");
  });

  it("/brand/login redirects to the brand tab of /login", async () => {
    expect(await landing("/brand/login")).toBe("/login?tab=brand");
  });
});
