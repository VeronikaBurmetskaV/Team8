import { NavLink, Outlet, useNavigate } from "react-router";
import { useLogoutBrand } from "../features/cabinet-auth/api";
import { errorMessage } from "./errors";
import { useSession } from "./session";

export function Layout() {
  // Loaded on every page: the first POST of a form needs the CSRF cookie it sets.
  const session = useSession();
  const logout = useLogoutBrand();
  const navigate = useNavigate();

  return (
    <div className="layout">
      <header className="layout-header">
        FULLA
        {session.data?.accountType === "BRAND" && (
          <nav className="layout-nav" aria-label="Кабінет бренду">
            <NavLink to="/brand/profile">Профіль</NavLink>
            <NavLink to="/brand/products">Товари</NavLink>
            <button
              type="button"
              disabled={logout.isPending}
              onClick={() =>
                logout.mutate(undefined, {
                  onSuccess: () => navigate("/brand/login"),
                })
              }
            >
              Вийти
            </button>
          </nav>
        )}
        {logout.isError && <p role="alert">{errorMessage(logout.error)}</p>}
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
