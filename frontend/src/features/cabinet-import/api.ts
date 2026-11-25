import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  apiPut,
  getBrandImportStatus,
  startBrandImport,
  verifyBrandSite,
} from "../../api/client";
import type { BrandProfileResponse, ImportStatus } from "../../api/types";
import {
  brandProfileQueryKey,
  toBrandProfile,
} from "../../shared/brandProfile";
import { isRunning } from "./siteImport";

export const importStatusKey = ["brand", "import", "status"] as const;

/** How often a running import is polled (the page stays usable meanwhile). */
export const POLL_MS = 3000;

/** Polling while the import runs, none otherwise (no load on the API between imports). */
export function pollInterval(status: ImportStatus | undefined): number | false {
  return isRunning(status) ? POLL_MS : false;
}

/** GET /api/brand/import/status; polled every 3 s while the import runs. */
export function useImportStatus(enabled: boolean) {
  return useQuery({
    queryKey: importStatusKey,
    queryFn: getBrandImportStatus,
    enabled,
    refetchInterval: (query) => (isRunning(query.state.data) ? POLL_MS : false),
  });
}

/** POST /api/brand/import: the answer (RUNNING) replaces the status and starts the polling. */
export function useStartImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startBrandImport,
    onSuccess: (status) => queryClient.setQueryData(importStatusKey, status),
  });
}

/** POST /api/brand/site/verify; the profile is reloaded to show the verified domain. */
export function useVerifySite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: verifyBrandSite,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: brandProfileQueryKey }),
  });
}

/**
 * Saves only the feed URL: PUT replaces the profile, so everything else is sent exactly as the
 * server has it (the same rule as the consent save).
 */
export function useSaveFeedUrl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      profile,
      feedUrl,
    }: {
      profile: BrandProfileResponse;
      feedUrl: string | null;
    }) =>
      toBrandProfile(
        await apiPut<unknown>("/api/brand/profile", {
          name: profile.name ?? "",
          websiteUrl: profile.websiteUrl,
          feedUrl,
          logoImageId: profile.logoImageId,
          logoUrl: profile.logoUrl,
          consentGiven: profile.consentGiven,
        }),
      ),
    onSuccess: (saved) => queryClient.setQueryData(brandProfileQueryKey, saved),
  });
}
