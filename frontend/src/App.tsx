import { createBrowserRouter, RouterProvider } from "react-router";
import { Layout } from "./shared/Layout";
import { NotFoundPage } from "./shared/NotFoundPage";
import { RequireBrand } from "./shared/RequireBrand";
import { StartPage } from "./features/start/StartPage";
import { FeedPage } from "./features/feed/FeedPage";
import { FavoritesPage } from "./features/favorites/FavoritesPage";
import { BuyerRegisterPage } from "./features/buyer-auth/BuyerRegisterPage";
import { BuyerLoginPage } from "./features/buyer-auth/BuyerLoginPage";
import { BrandRegisterPage } from "./features/cabinet-auth/BrandRegisterPage";
import { BrandLoginPage } from "./features/cabinet-auth/BrandLoginPage";
import { BrandProfilePage } from "./features/cabinet-profile/BrandProfilePage";
import { BrandProductsPage } from "./features/cabinet-products/BrandProductsPage";
import { BrandProductPage } from "./features/cabinet-products/BrandProductPage";

// Routes from ADR-0008 and overview.md §5.
const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <StartPage /> },
      { path: "/feed", element: <FeedPage /> },
      { path: "/favorites", element: <FavoritesPage /> },
      { path: "/register", element: <BuyerRegisterPage /> },
      { path: "/login", element: <BuyerLoginPage /> },
      { path: "/brand/register", element: <BrandRegisterPage /> },
      { path: "/brand/login", element: <BrandLoginPage /> },
      {
        // Cabinet pages need a brand session (US-21.1 CL).
        element: <RequireBrand />,
        children: [
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
