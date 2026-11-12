import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router";
import { ApiError, getHealth } from "../api/client";
import { useLogoutBrand } from "../features/cabinet-auth/api";
import { messages } from "./messages.uk";
import { useSession } from "./session";

type ApiStatus = "checking" | "up" | "down";

const statusText: Record<ApiStatus, string> = {
  checking: "API: перевірка…",
  up: "API: працює",
  down: "API: недоступний",
};

export function Layout() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");
  // Loaded on every page: the first POST of a form needs the CSRF cookie it sets.
  const session = useSession();
  const logout = useLogoutBrand();
  const navigate = useNavigate();

  useEffect(() => {
    getHealth()
      .then(() => setApiStatus("up"))
      .catch(() => setApiStatus("down"));
  }, []);

  const logoutErrorText = logout.isError
    ? messages[
        logout.error instanceof ApiError
          ? logout.error.code
          : "SERVICE_UNAVAILABLE"
      ]
    : null;

  return (
    <div className="layout">
      <header className="layout-header">
        FULLA
        {session.data?.accountType === "BRAND" && (
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
        )}
        {logoutErrorText && <p role="alert">{logoutErrorText}</p>}
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="layout-footer">{statusText[apiStatus]}</footer>
    </div>
  );
}
