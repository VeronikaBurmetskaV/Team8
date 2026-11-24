import { createBrowserRouter, RouterProvider } from "react-router";
import { legacyRoutes } from "./legacyRoutes";
import { Layout } from "./shared/Layout";
import { NotFoundPage } from "./shared/NotFoundPage";
import { RequireBrand } from "./shared/RequireBrand";
import { CatalogPage } from "./features/catalog/CatalogPage";
import { FeedPage } from "./features/feed/FeedPage";
import { FavoritesPage } from "./features/favorites/FavoritesPage";
import { BuyerRegisterPage } from "./features/buyer-auth/BuyerRegisterPage";
import { LoginPage } from "./features/buyer-auth/LoginPage";
import { CartPage } from "./features/cart/CartPage";
import { BrandRegisterPage } from "./features/cabinet-auth/BrandRegisterPage";
import { BrandHomePage } from "./features/cabinet-home/BrandHomePage";
import { BrandProfilePage } from "./features/cabinet-profile/BrandProfilePage";
import { BrandProductsPage } from "./features/cabinet-products/BrandProductsPage";
import { BrandProductPage } from "./features/cabinet-products/BrandProductPage";

// Routes from ADR-0008 and overview.md §5.
const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <CatalogPage /> },
      { path: "/feed", element: <FeedPage /> },
      // Old addresses that moved (legacyRoutes.ts).
      ...legacyRoutes,
      { path: "/favorites", element: <FavoritesPage /> },
      { path: "/register", element: <BuyerRegisterPage /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/cart", element: <CartPage /> },
      { path: "/brand/register", element: <BrandRegisterPage /> },
      {
        // Cabinet pages need a brand session (US-21.1 CL).
        element: <RequireBrand />,
        children: [
          { path: "/brand", element: <BrandHomePage /> },
          { path: "/brand/profile", element: <BrandProfilePage /> },
          { path: "/brand/products", element: <BrandProductsPage /> },
          { path: "/brand/products/:id", element: <BrandProductPage /> },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
