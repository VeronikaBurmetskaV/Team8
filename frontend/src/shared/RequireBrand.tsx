import { Navigate, Outlet } from "react-router";
import { errorMessage } from "./errors";
import { useSession } from "./session";

/**
 * Route wrapper for the cabinet pages: without a brand session the user goes to the
 * brand login page (US-21.1 CL). Convenience only — the server stays the authority.
 */
export function RequireBrand() {
  const session = useSession();

  if (session.data === undefined) {
    if (session.isPending) return <p>Завантаження…</p>;
    return <p role="alert">{errorMessage(session.error)}</p>;
  }
  if (session.data.accountType !== "BRAND") {
    return <Navigate to="/brand/login" replace />;
  }
  return <Outlet />;
}
