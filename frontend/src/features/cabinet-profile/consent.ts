import type {
  BrandProfileRequest,
  BrandProfileResponse,
} from "../../api/types";

/**
 * The consent checkbox flow (US-22.2, INV-09). The lock itself always comes from the server's
 * answer (`profile.consentGiven`): this state only covers the dialog and the save in flight.
 *
 * idle ──tick──► confirming ──confirm──► saving ──success/failure──► idle
 *                     └──────cancel──────► idle
 */
export type ConsentStep = "idle" | "confirming" | "saving";

export type ConsentEvent =
  "tick" | "cancel" | "confirm" | "saveSucceeded" | "saveFailed";

export type ConsentTransition = {
  step: ConsentStep;
  /** true only for «Підтвердити»: the one moment the consent is sent to the server. */
  save: boolean;
};

/** Ticking is possible only for a saved name and a consent the server does not have yet. */
export function canGiveConsent(profile: BrandProfileResponse): boolean {
  return !profile.consentGiven && profile.name !== null;
}

export function consentTransition(
  step: ConsentStep,
  event: ConsentEvent,
  profile: BrandProfileResponse,
): ConsentTransition {
  const stay = { step, save: false };
  switch (event) {
    case "tick":
      return step === "idle" && canGiveConsent(profile)
        ? { step: "confirming", save: false }
        : stay;
    case "cancel":
      return step === "confirming" ? { step: "idle", save: false } : stay;
    case "confirm":
      return step === "confirming" ? { step: "saving", save: true } : stay;
    case "saveSucceeded":
    case "saveFailed":
      return step === "saving" ? { step: "idle", save: false } : stay;
  }
}

/** What the checkbox shows: ticked and locked for good once the server has the consent. */
export function consentCheckbox(
  profile: BrandProfileResponse,
  step: ConsentStep,
): { checked: boolean; disabled: boolean } {
  if (profile.consentGiven) return { checked: true, disabled: true };
  return {
    checked: step === "saving",
    disabled: step === "saving" || !canGiveConsent(profile),
  };
}

/**
 * PUT /api/brand/profile that records only the consent: the name, website and logo are sent
 * exactly as the server has them (PUT replaces the profile: a missing website would clear it),
 * so unsaved edits in the form are not saved with it.
 */
export function toConsentRequest(
  profile: BrandProfileResponse,
): BrandProfileRequest {
  return {
    name: profile.name ?? "",
    websiteUrl: profile.websiteUrl,
    logoImageId: profile.logoImageId,
    logoUrl: profile.logoUrl,
    consentGiven: true,
  };
}
