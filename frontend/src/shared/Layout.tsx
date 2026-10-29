import { useEffect, useState } from "react";
import { Outlet } from "react-router";
import { getHealth } from "../api/client";

type ApiStatus = "checking" | "up" | "down";

const statusText: Record<ApiStatus, string> = {
  checking: "API: перевірка…",
  up: "API: працює",
  down: "API: недоступний",
};

export function Layout() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");

  useEffect(() => {
    getHealth()
      .then(() => setApiStatus("up"))
      .catch(() => setApiStatus("down"));
  }, []);

  return (
    <div className="layout">
      <header className="layout-header">FULLA</header>
      <main>
        <Outlet />
      </main>
      <footer className="layout-footer">{statusText[apiStatus]}</footer>
    </div>
  );
}
