import { z } from "zod";
import type { ErrorCode } from "../api/types";
import { brandNameInvalidMessage, messages } from "./messages.uk";

// Form schemas that repeat the backend rules for instant feedback (ADR-0008, R-T17).
// The API stays the authority: its error `fields` are shown on the form as well.

/**
 * Same pattern as StrictEmailValidator.EMAIL on the backend: name@domain.tld, one @, and no
 * whitespace, control characters (\p{Cc}) or Unicode separators (\p{Z}) anywhere.
 */
const EMAIL =
  /^[^@\s\p{Cc}\p{Z}]+@[^@\s\p{Cc}\p{Z}.]+(\.[^@\s\p{Cc}\p{Z}.]+)+$/u;
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

/** Brand name in the profile (US-22.1): 2–50 characters after trimming, no control characters. */
export const brandNameSchema = z.object({
  name: z
    .string()
    .trim()
    .refine((name) => {
      const length = codePointLength(name);
      return length >= NAME_MIN && length <= NAME_MAX && !/\p{Cc}/u.test(name);
    }, brandNameInvalidMessage),
});

export type BrandNameForm = z.infer<typeof brandNameSchema>;

// ---- Product card form (US-25.1, US-26) ----

// Mirrors the backend Bean Validation rules for instant feedback (api.md §1).
// Every issue message is an ErrorCode; the texts live in messages.uk.ts.

export const IMAGE_MAX_BYTES = 5_242_880;
export const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const PRICE_MAX_UAH = 1_000_000;
/** Counted in code points, like the brand name. */
const CARD_NAME_MAX = 100;

const NAME: ErrorCode = "CARD_INVALID_NAME";
const PRICE_OR_PHOTO: ErrorCode = "CARD_INVALID_PRICE_OR_PHOTO";
const URL_CODE: ErrorCode = "CARD_INVALID_URL";

// ---- URLs: the backend is the reference (final-review №6) ----
//
// HttpUrlValidator / HttpsUrlValidator accept a URL when java.net.URI parses it and getHost()
// is not null. The browser's `new URL` is much more lenient (IDN hosts, "_", "|", "[" in the
// path…), so the rules of java.net.URI (RFC 2396) are repeated here instead. Both sides are
// tested with validation.examples.json.
//
// IDN hosts such as `магазин.укр`: MVP: не підтримуємо, Post-MVP: IDN.toASCII. The punycode
// form (`xn--…`) is accepted on both sides.

/** RFC 2396 "unreserved" characters. */
const UNRESERVED = "A-Za-z0-9\\-_.!~*'()";
/** A %XX escape. */
const ESCAPED = "%[0-9A-Fa-f]{2}";
/** Non-ASCII characters java.net.URI allows unescaped: neither control (Cc) nor space (Z*). */
const OTHER = "[^\\x00-\\x7F\\p{Cc}\\p{Z}]";

function uriPart(extra: string): RegExp {
  return new RegExp(`^(?:[${UNRESERVED}${extra}]|${ESCAPED}|${OTHER})*$`, "u");
}

const USER_INFO = uriPart(";:&=+$,");
const PATH = uriPart(":@&=+$,;/");
const QUERY_OR_FRAGMENT = uriPart(";/?:@&=+$,\\[\\]");
const LABEL = "[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?";
const HOSTNAME = new RegExp(`^${LABEL}(?:\\.${LABEL})*\\.?$`);
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6 = /^\[[0-9A-Fa-f:.]+\]$/;
/** scheme://authority path ?query #fragment */
const URI_PARTS =
  /^([A-Za-z][A-Za-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/su;
const MAX_PORT = 2_147_483_647; // Java parses the port as an int

function isIpv6(host: string): boolean {
  if (!IPV6.test(host)) return false;
  try {
    return new URL(`http://${host}/`).hostname !== "";
  } catch {
    return false;
  }
}

function isHost(host: string): boolean {
  const ipv4 = IPV4.exec(host);
  if (ipv4) return ipv4.slice(1).every((octet) => Number(octet) <= 255);
  if (host.startsWith("[")) return isIpv6(host);
  if (!HOSTNAME.test(host)) return false;
  // In a dotted name the last label starts with a letter ("brand.123" is not a host name).
  const labels = host.replace(/\.$/, "").split(".");
  return (
    labels.length === 1 || /^[A-Za-z]/.test(labels[labels.length - 1] ?? "")
  );
}

function isAuthority(authority: string): boolean {
  const at = authority.indexOf("@");
  if (at >= 0 && !USER_INFO.test(authority.slice(0, at))) return false;
  const hostPort = authority.slice(at + 1);
  const port = /:(\d*)$/.exec(hostPort);
  if (port && Number(port[1] || "0") > MAX_PORT) return false;
  return isHost(port ? hostPort.slice(0, port.index) : hostPort);
}

function isUrlWithHost(
  value: string,
  scheme: (scheme: string) => boolean,
): boolean {
  const parts = URI_PARTS.exec(value);
  if (!parts) return false;
  const [, schemePart = "", authority = "", path = "", query, fragment] = parts;
  return (
    scheme(schemePart) &&
    isAuthority(authority) &&
    PATH.test(path) &&
    (query === undefined || QUERY_OR_FRAGMENT.test(query.slice(1))) &&
    (fragment === undefined || QUERY_OR_FRAGMENT.test(fragment.slice(1)))
  );
}

/** Absolute URL with scheme http/https (any case) and a host, like @HttpUrl (US-26). */
export function isHttpUrl(value: string): boolean {
  return isUrlWithHost(value, (scheme) => /^https?$/i.test(scheme));
}

/** External image URL: lowercase `https://` only, like @HttpsUrl (ADR-0007). */
export function isHttpsUrl(value: string): boolean {
  return value.startsWith("https://") && isUrlWithHost(value, () => true);
}

/** Whole positive number of UAH typed into the price field. */
export function isValidPrice(value: string): boolean {
  if (!/^\d+$/.test(value)) return false;
  const price = Number(value);
  return price > 0 && price <= PRICE_MAX_UAH;
}

/** Exactly one of: an uploaded file or an https:// image URL (api.md §4.1). */
const photoSchema = z
  .object({
    file: z.custom<File>((value) => value instanceof File).nullable(),
    url: z.string().trim(),
  })
  .refine(
    ({ file, url }) => {
      if (file !== null && url !== "") return false;
      if (file !== null) {
        return (
          IMAGE_MIME_TYPES.includes(file.type) &&
          file.size > 0 &&
          file.size <= IMAGE_MAX_BYTES
        );
      }
      return isHttpsUrl(url);
    },
    { message: PRICE_OR_PHOTO },
  );

/** The card form (US-25.1, US-26), fields in the order of the form. */
export const cardFormSchema = z.object({
  name: z
    .string()
    .trim()
    .refine(
      (name) => {
        const length = codePointLength(name);
        return length >= 1 && length <= CARD_NAME_MAX;
      },
      { message: NAME },
    ),
  priceUah: z.string().trim().refine(isValidPrice, { message: PRICE_OR_PHOTO }),
  photo: photoSchema,
  productUrl: z.string().trim().refine(isHttpUrl, { message: URL_CODE }),
});

export type CardFormValues = z.infer<typeof cardFormSchema>;
