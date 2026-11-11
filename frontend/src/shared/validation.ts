import { z } from "zod";
import { brandNameInvalidMessage, messages } from "./messages.uk";

// Form schemas that repeat the backend rules for instant feedback (ADR-0008, R-T17).
// The API stays the authority: its error `fields` are shown on the form as well.

/** Same pattern as BrandAuthService.EMAIL: name@domain.tld, one @, no spaces. */
const EMAIL = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;
const EMAIL_MAX = 254;
const PASSWORD_MIN = 8;
/** BCrypt limit, counted in UTF-8 bytes like the backend does (Q-11). */
const PASSWORD_MAX_BYTES = 72;
const NAME_MIN = 2;
const NAME_MAX = 50;

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).length;
}

/** Code points, like the backend and char_length() in the database. */
function codePointLength(value: string): number {
  return [...value].length;
}

/** Brand registration (US-21). The email is trimmed and lower-cased like on the server. */
export const brandRegisterSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(EMAIL_MAX, messages.EMAIL_TAKEN_OR_INVALID)
    .regex(EMAIL, messages.EMAIL_TAKEN_OR_INVALID),
  // The password is not trimmed: spaces are part of it.
  password: z
    .string()
    .min(PASSWORD_MIN, messages.PASSWORD_TOO_SHORT)
    .refine(
      (password) => utf8Length(password) <= PASSWORD_MAX_BYTES,
      messages.PASSWORD_TOO_SHORT,
    ),
});

export type BrandRegisterForm = z.infer<typeof brandRegisterSchema>;

/**
 * Brand login (US-21.1). Only "not empty" is checked: the registration rules here
 * would hint which field is wrong, and the answer must be one common message.
 */
export const brandLoginSchema = z.object({
  email: z.string().trim().min(1, messages.INVALID_CREDENTIALS),
  password: z.string().min(1, messages.INVALID_CREDENTIALS),
});

export type BrandLoginForm = z.infer<typeof brandLoginSchema>;

/** Brand name in the profile (US-22.1): 2–50 characters after trimming. */
export const brandNameSchema = z.object({
  name: z
    .string()
    .trim()
    .refine((name) => {
      const length = codePointLength(name);
      return length >= NAME_MIN && length <= NAME_MAX;
    }, brandNameInvalidMessage),
});

export type BrandNameForm = z.infer<typeof brandNameSchema>;
