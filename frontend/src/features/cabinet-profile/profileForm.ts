import { z } from "zod";
import type {
  BrandProfileRequest,
  BrandProfileResponse,
} from "../../api/types";
import { toFormErrors } from "../../shared/errors";
import {
  brandNameInvalidMessage,
  messages,
  websiteUrlInvalidMessage,
} from "../../shared/messages.uk";
import { brandNameSchema, optionalWebsiteUrl } from "../../shared/validation";

/** Label of the consent checkbox — exact text from US-22.2 CL, do not reword. */
export const CONSENT_TEXT =
  "Я надаю згоду платформі FULLA на демонстрацію логотипа, фотографій та інформації про товари мого бренду";

/**
 * The profile form: the brand name (US-22.1) and the consent (US-22.2). The consent is not
 * required to save: a name-only save is valid (Incomplete → Active); it is required to publish.
 */
export const brandProfileFormSchema = brandNameSchema.extend({
  /** «Сайт бренду»: entered at registration (US-21), editable here; empty = none. */
  websiteUrl: optionalWebsiteUrl,
  consentGiven: z.boolean(),
});

export type BrandProfileForm = z.infer<typeof brandProfileFormSchema>;

/** Request field of PUT /api/brand/profile → the input that shows its error. */
export const profileFields = {
  name: "name",
  websiteUrl: "websiteUrl",
  consentGiven: "consentGiven",
} as const;

/** Form values as the server knows them: the checkbox is unchecked until consent is saved. */
export function toBrandProfileFormValues(
  profile: BrandProfileResponse,
): BrandProfileForm {
  return {
    name: profile.name ?? "",
    websiteUrl: profile.websiteUrl ?? "",
    consentGiven: profile.consentGiven,
  };
}

/**
 * Body of PUT /api/brand/profile. The logo is sent back as loaded (not edited here).
 * Consent already saved on the server is always sent as `true`: the brand cannot withdraw it
 * (INV-09), so the form never sends a withdrawal.
 */
export function toBrandProfileRequest(
  values: BrandProfileForm,
  profile: BrandProfileResponse,
): BrandProfileRequest {
  return {
    name: values.name,
    // PUT replaces the profile: an empty field clears the website.
    websiteUrl: values.websiteUrl === "" ? null : values.websiteUrl,
    logoImageId: profile.logoImageId,
    logoUrl: profile.logoUrl,
    consentGiven: profile.consentGiven || values.consentGiven,
  };
}

/**
 * The texts of a failed save, by input: PROFILE_INVALID on the name or the website gets that
 * field's own hint (under the field, never the common «Сервіс тимчасово недоступний»); other
 * codes keep their dictionary text; an error without a field goes above the button.
 */
export function profileSaveErrors(error: unknown): {
  name?: string;
  websiteUrl?: string;
  consentGiven?: string;
  form?: string;
} {
  const { fields, form } = toFormErrors(error, profileFields);
  const texts: ReturnType<typeof profileSaveErrors> = {};
  if (fields.name) {
    texts.name =
      fields.name === "PROFILE_INVALID"
        ? brandNameInvalidMessage
        : messages[fields.name];
  }
  if (fields.websiteUrl) {
    texts.websiteUrl =
      fields.websiteUrl === "PROFILE_INVALID"
        ? websiteUrlInvalidMessage
        : messages[fields.websiteUrl];
  }
  if (fields.consentGiven) texts.consentGiven = messages[fields.consentGiven];
  if (form) texts.form = messages[form];
  return texts;
}
