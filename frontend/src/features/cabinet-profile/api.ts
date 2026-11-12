import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPut } from "../../api/client";
import type {
  BrandProfileRequest,
  BrandProfileResponse,
} from "../../api/types";

const brandProfileQueryKey = ["brand", "profile"] as const;

/** GET /api/brand/profile. Without a brand session the API client redirects to /brand/login. */
export function useBrandProfile() {
  return useQuery({
    queryKey: brandProfileQueryKey,
    queryFn: () => apiGet<BrandProfileResponse>("/api/brand/profile"),
  });
}

/** PUT /api/brand/profile (US-22.1); the answer is the saved profile and replaces the loaded one. */
export function useSaveBrandProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profile: BrandProfileRequest) =>
      apiPut<BrandProfileResponse>("/api/brand/profile", profile),
    onSuccess: (saved) => queryClient.setQueryData(brandProfileQueryKey, saved),
  });
}
