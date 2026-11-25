import { useQuery, type QueryClient } from "@tanstack/react-query";
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

/**
 * The account in this browser has changed (login, register, logout): forget everything
 * loaded for the previous one and ask the server again who is logged in.
 */
export function resetForNewSession(queryClient: QueryClient) {
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== sessionQueryKey[0],
  });
  return queryClient.invalidateQueries({ queryKey: sessionQueryKey });
}
