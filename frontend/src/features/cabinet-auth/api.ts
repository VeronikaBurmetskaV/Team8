import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { ApiError, apiPost } from "../../api/client";
import type {
  BrandCredentialsRequest,
  BrandSessionResponse,
} from "../../api/types";
import { sessionQueryKey } from "../../shared/session";

/**
 * The account in this browser has changed: forget everything loaded for the previous one
 * (profile, products) and ask the server again who is logged in.
 */
function resetForNewSession(queryClient: QueryClient) {
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== sessionQueryKey[0],
  });
  return queryClient.invalidateQueries({ queryKey: sessionQueryKey });
}

/** POST /api/brand/register (US-21): creates the account and logs the brand in. */
export function useRegisterBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: BrandCredentialsRequest) =>
      apiPost<BrandSessionResponse>("/api/brand/register", credentials),
    onSuccess: () => resetForNewSession(queryClient),
  });
}

/** POST /api/brand/login (US-21.1). */
export function useLoginBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: BrandCredentialsRequest) =>
      apiPost<BrandSessionResponse>("/api/brand/login", credentials),
    onSuccess: () => resetForNewSession(queryClient),
  });
}

/** POST /api/brand/logout (US-21.1). */
export function useLogoutBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        await apiPost<void>("/api/brand/logout");
      } catch (error) {
        // The session is already gone (e.g. the server restarted): that is a logout too.
        if (!(error instanceof ApiError && error.code === "UNAUTHENTICATED")) {
          throw error;
        }
      }
    },
    onSuccess: () => resetForNewSession(queryClient),
  });
}
