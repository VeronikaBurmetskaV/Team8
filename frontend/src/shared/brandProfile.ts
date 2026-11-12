import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../api/client";
import type { BrandProfileResponse } from "../api/types";

export const brandProfileQueryKey = ["brand", "profile"] as const;

/**
 * GET /api/brand/profile. Shared: the profile page edits it, the product list needs its state.
 * Without a brand session the API client redirects to /brand/login.
 */
export function useBrandProfile() {
  return useQuery({
    queryKey: brandProfileQueryKey,
    queryFn: () => apiGet<BrandProfileResponse>("/api/brand/profile"),
  });
}
