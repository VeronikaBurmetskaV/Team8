import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useLogoutBrand } from "../features/cabinet-auth/api";
import { errorMessage } from "./errors";
import { useSession } from "./session";

export function Layout() {
  // Loaded on every page: the first POST of a form needs the CSRF cookie it sets.
  const session = useSession();
  const logout = useLogoutBrand();
  const navigate = useNavigate();
  // ADR-0002: the cabinet (/brand/...) is desktop-first and gets the wide container,
  // buyer pages stay in the narrow one. Widths are tokens in tokens.css.
  const { pathname } = useLocation();
  const isCabinet = pathname === "/brand" || pathname.startsWith("/brand/");

  return (
    <div className={isCabinet ? "layout layout--wide" : "layout"}>
      <header className="layout-header">
        <div className="layout-header-inner">
          <span className="layout-logo">FULLA</span>
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
        </div>
      </header>
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  );
}
