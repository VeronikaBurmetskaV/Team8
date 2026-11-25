import { toFormErrors } from "../../shared/errors";
import {
  brandNameInvalidMessage,
  buyerAuthTexts,
  messages,
  websiteUrlInvalidMessage,
} from "../../shared/messages.uk";

/** The inputs of /brand/register, in form order (= the order of the request record). */
export const REGISTER_FIELDS = [
  "contactName",
  "name",
  "websiteUrl",
  "email",
  "password",
] as const;
export type RegisterField = (typeof REGISTER_FIELDS)[number];

/** Ukrainian texts for a failed POST /api/brand/register: per input, or once for the form. */
export interface RegisterErrors {
  fields: Partial<Record<RegisterField, string>>;
  form: string | null;
}

/**
 * Spreads the error envelope over the form (api.md §2.1, §3.2): VALIDATION_FAILED on
 * `contactName` gets the name hint; PROFILE_INVALID on `name` or
 * `websiteUrl` gets the hint for that field (the dictionary text of PROFILE_INVALID talks
 * about the logo); every other code keeps its own text. Never a raw server message.
 */
export function brandRegisterErrors(error: unknown): RegisterErrors {
  const { fields, form } = toFormErrors(error, {
    contactName: "contactName",
    name: "name",
    websiteUrl: "websiteUrl",
    email: "email",
    password: "password",
  } as const);
  const texts: RegisterErrors["fields"] = {};
  for (const field of REGISTER_FIELDS) {
    const code = fields[field];
    if (code === undefined) continue;
    if (code === "VALIDATION_FAILED" && field === "contactName") {
      // Empty or longer than 50: the form checks both first, so the length text covers it.
      texts.contactName = buyerAuthTexts.nameInvalid;
    } else if (code === "PROFILE_INVALID" && field === "name") {
      texts.name = brandNameInvalidMessage;
    } else if (code === "PROFILE_INVALID" && field === "websiteUrl") {
      texts.websiteUrl = websiteUrlInvalidMessage;
    } else {
      texts[field] = messages[code];
    }
  }
  return { fields: texts, form: form === null ? null : messages[form] };
}
