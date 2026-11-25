/**
 * The buyer's «Email або номер телефону» (US-02, ADR-0016): with «@» it is an email (the strict
 * email rule, trimmed and lower-cased), otherwise a phone number normalized to E.164. The same
 * rules as LoginId.parse on the backend; both sides test validation.examples.json («loginId»).
 * Kept for the login form too, once buyer login exists (US-03).
 *
 * Phone: only digits, spaces, brackets, hyphens and a leading «+». Ukrainian numbers written as
 * 0XXXXXXXXX, 380XXXXXXXXX or +380XXXXXXXXX become +380XXXXXXXXX; other countries need a leading
 * «+» and 8–15 digits (the first not 0). Not verified by SMS.
 */
export type LoginId = { kind: "email" | "phone"; value: string };

/** Same pattern as StrictEmailValidator.EMAIL on the backend (name@domain.tld). */
const EMAIL =
  /^[^@\s\p{Cc}\p{Z}]+@[^@\s\p{Cc}\p{Z}.]+(\.[^@\s\p{Cc}\p{Z}.]+)+$/u;
const EMAIL_MAX = 254;
const PHONE_CHARS = /^\+?[0-9 ()-]+$/;
/** E.164, the same as the buyer_accounts CHECK. */
export const E164 = /^\+[1-9][0-9]{7,14}$/;

/** Spaces at the ends, including non-breaking ones, like UnicodeText.trim on the backend. */
function trim(value: string): string {
  return value.replace(/^[\s\p{Z}]+|[\s\p{Z}]+$/gu, "");
}

function normalizePhone(text: string): string | null {
  if (!PHONE_CHARS.test(text)) return null;
  const plus = text.startsWith("+");
  const digits = (plus ? text.slice(1) : text).replace(/[ ()-]/g, "");
  let e164: string;
  if (plus) {
    // A Ukrainian number has exactly 9 digits after 380.
    if (digits.startsWith("380") && digits.length !== 12) return null;
    e164 = `+${digits}`;
  } else if (digits.length === 10 && digits.startsWith("0")) {
    e164 = `+380${digits.slice(1)}`;
  } else if (digits.length === 12 && digits.startsWith("380")) {
    e164 = `+${digits}`;
  } else {
    return null;
  }
  return E164.test(e164) ? e164 : null;
}

/** The login, normalized, or null when it is neither a valid email nor a valid phone number. */
export function parseLoginId(raw: string): LoginId | null {
  const text = trim(raw);
  if (text === "") return null;
  if (text.includes("@")) {
    const email = text.toLowerCase();
    return email.length <= EMAIL_MAX && EMAIL.test(email)
      ? { kind: "email", value: email }
      : null;
  }
  const phone = normalizePhone(text);
  return phone === null ? null : { kind: "phone", value: phone };
}
