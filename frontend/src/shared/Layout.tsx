import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useState } from "react";
import { useLogoutBrand } from "../features/cabinet-auth/api";
import { ConfirmDialog } from "./ConfirmDialog";
import { BuyerHeader } from "./BuyerHeader";
import { errorMessage } from "./errors";
import { confirmTexts } from "./messages.uk";
import { useSession } from "./session";

export function Layout() {
  // Loaded on every page: the first POST of a form needs the CSRF cookie it sets.
  const session = useSession();
  const logout = useLogoutBrand();
  // «Вийти» only asks; the logout runs after the confirmation in the dialog.
  const [confirmLogout, setConfirmLogout] = useState(false);
  const navigate = useNavigate();
  // ADR-0002: the cabinet (/brand/...) is desktop-first and gets the wide container,
  // buyer pages stay in the narrow one. Widths are tokens in tokens.css.
  const { pathname } = useLocation();
  const isCabinet = pathname === "/brand" || pathname.startsWith("/brand/");
  // The catalogue home page, the feed (buttons beside the card) and the «Вподобане» grid need the room on a laptop;
  // the pages themselves keep their content narrow where needed.
  const isWide =
    isCabinet ||
    pathname === "/" ||
    pathname === "/feed" ||
    pathname === "/favorites";

  return (
    <div className={isWide ? "layout layout--wide" : "layout"}>
      {/* Buyer pages get the new header; the cabinet keeps its own, unchanged. */}
      {!isCabinet && <BuyerHeader />}
      {isCabinet && (
        <header className="layout-header">
          <div className="layout-header-inner">
            <Link className="layout-logo" to="/brand">
              FULLA
            </Link>
            {session.data?.accountType === "BRAND" && (
              <nav className="layout-nav" aria-label="Кабінет бренду">
                {/* end: «Головна» is not highlighted on /brand/profile and /brand/products. */}
                <NavLink to="/brand" end>
                  Головна
                </NavLink>
                <NavLink to="/brand/profile">Профіль</NavLink>
                <NavLink to="/brand/products">Товари</NavLink>
                <button
                  type="button"
                  disabled={logout.isPending}
                  onClick={() => setConfirmLogout(true)}
                >
                  Вийти
                </button>
              </nav>
            )}
            {logout.isError && <p role="alert">{errorMessage(logout.error)}</p>}
            <ConfirmDialog
              open={confirmLogout}
              title={confirmTexts.logoutQuestion}
              confirmLabel={confirmTexts.logoutConfirm}
              onConfirm={() => {
                setConfirmLogout(false);
                logout.mutate(undefined, {
                  onSuccess: () => navigate("/login?tab=brand"),
                });
              }}
              onCancel={() => setConfirmLogout(false)}
            />
          </div>
        </header>
      )}
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  );
}
