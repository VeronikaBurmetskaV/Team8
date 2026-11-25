import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiPost } from "../../api/client";
import type {
  BrandCredentialsRequest,
  BrandRegisterRequest,
  BrandSessionResponse,
} from "../../api/types";
import { resetForNewSession } from "../../shared/session";

/**
 * POST /api/brand/register (US-21): creates the account with the brand name and website in
 * the profile, and logs the brand in.
 */
export function useRegisterBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: BrandRegisterRequest) =>
      apiPost<BrandSessionResponse>("/api/brand/register", body),
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
