import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../api/client";
import type { BrandProfileResponse, ProfileState } from "../api/types";

export const brandProfileQueryKey = ["brand", "profile"] as const;

/**
 * GET /api/brand/profile. Shared: the profile page edits it, the product list needs its state.
 * Without a brand session the API client redirects to /login?tab=brand.
 */
export function useBrandProfile() {
  return useQuery({
    queryKey: brandProfileQueryKey,
    queryFn: async () =>
      toBrandProfile(await apiGet<unknown>("/api/brand/profile")),
  });
}

const STATES: readonly ProfileState[] = ["INCOMPLETE", "ACTIVE", "CONSENTED"];

/** A string field of the answer, or null when it is missing, null or not a string. */
function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * The profile answer (GET and PUT /api/brand/profile) exactly as the type promises: a missing
 * key becomes null. A backend started before a field was added (e.g. `websiteUrl`, 2026-11-26)
 * leaves the key out, and `undefined` would slip past every `=== null` check in the cabinet.
 */
export function toBrandProfile(raw: unknown): BrandProfileResponse {
  const data =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  const name = text(data.name);
  const consentGivenAt = text(data.consentGivenAt);
  const state = STATES.find((value) => value === data.state);
  return {
    contactName: text(data.contactName),
    name,
    websiteUrl: text(data.websiteUrl),
    logoImageId: text(data.logoImageId),
    logoUrl: text(data.logoUrl),
    consentGiven: data.consentGiven === true,
    logoDisplayUrl: text(data.logoDisplayUrl),
    consentGivenAt,
    consentText: text(data.consentText),
    feedUrl: text(data.feedUrl),
    siteDomain: text(data.siteDomain),
    siteVerifiedAt: text(data.siteVerifiedAt),
    verificationToken: text(data.verificationToken),
    // Derived like the server does (domain-model.md §4.1) when the answer has no state.
    state:
      state ??
      (name === null
        ? "INCOMPLETE"
        : consentGivenAt === null
          ? "ACTIVE"
          : "CONSENTED"),
  };
}
