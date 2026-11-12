import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPut } from "../../api/client";
import type {
  BrandProfileRequest,
  BrandProfileResponse,
} from "../../api/types";
import { brandProfileQueryKey } from "../../shared/brandProfile";

/** PUT /api/brand/profile (US-22.1); the answer is the saved profile and replaces the loaded one. */
export function useSaveBrandProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profile: BrandProfileRequest) =>
      apiPut<BrandProfileResponse>("/api/brand/profile", profile),
    onSuccess: (saved) => queryClient.setQueryData(brandProfileQueryKey, saved),
  });
}
