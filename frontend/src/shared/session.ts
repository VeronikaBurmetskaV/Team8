import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../api/client";
import type { SessionResponse } from "../api/types";

/** Invalidate this key after login, register and logout. */
export const sessionQueryKey = ["session"] as const;

/**
 * Who is logged in (GET /api/session). The answer also sets the XSRF-TOKEN cookie
 * that every POST/PUT needs, so the layout calls this hook on every page.
 */
export function useSession() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: () => apiGet<SessionResponse>("/api/session"),
  });
}
