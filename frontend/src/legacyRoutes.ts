import { redirect, type RouteObject } from "react-router";
import { loginPath } from "./features/buyer-auth/loginTabs";

/**
 * Addresses that no longer have a page of their own. «Вподобане зі свайпів» was merged into
 * «Вподобане», so an old link or bookmark lands there.
 */
export const legacyRoutes: RouteObject[] = [
  { path: "/swipe-favorites", loader: () => redirect("/favorites") },
  // Brand login became the «Вхід для бренду» tab of the single /login page.
  { path: "/brand/login", loader: () => redirect(loginPath("brand")) },
];
