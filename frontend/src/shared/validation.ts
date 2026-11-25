import { z } from "zod";
import type { ErrorCode } from "../api/types";
import { parseLoginId } from "./loginId";
import {
  brandNameInvalidMessage,
  buyerAuthTexts,
  loginTexts,
  messages,
  websiteUrlInvalidMessage,
} from "./messages.uk";

// Form schemas that repeat the backend rules for instant feedback (ADR-0008, R-T17).
// The API stays the authority: its error `fields` are shown on the form as well.

/**
 * Same pattern as StrictEmailValidator.EMAIL on the backend: name@domain.tld, one @, and no
 * whitespace, control characters (\p{Cc}) or Unicode separators (\p{Z}) anywhere.
 */
const EMAIL =
  /^[^@\s\p{Cc}\p{Z}]+@[^@\s\p{Cc}\p{Z}.]+(\.[^@\s\p{Cc}\p{Z}.]+)+$/u;
const EMAIL_MAX = 254;
/** Same as PasswordLengthValidator.MIN_CHARACTERS on the backend (api.md §2.3). */
export const PASSWORD_MIN = 8;
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

/** Email of a new account: trimmed and lower-cased like on the server, @StrictEmail rules. */
const newAccountEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(EMAIL_MAX, messages.EMAIL_TAKEN_OR_INVALID)
  .regex(EMAIL, messages.EMAIL_TAKEN_OR_INVALID);

/** Password of a new account, @PasswordLength rules. Not trimmed: spaces are part of it. */
const newAccountPassword = z
  .string()
  .min(PASSWORD_MIN, messages.PASSWORD_TOO_SHORT)
  .refine(
    (password) => utf8Length(password) <= PASSWORD_MAX_BYTES,
    messages.PASSWORD_TOO_SHORT,
  );

/** Brand name: 2–50 characters after trimming, no control characters (US-22.1 CL, @BrandName). */
const brandName = z
  .string()
  .trim()
  .refine((name) => {
    const length = codePointLength(name);
    return length >= NAME_MIN && length <= NAME_MAX && !/\p{Cc}/u.test(name);
  }, brandNameInvalidMessage);

/**
 * A person's name: the buyer's «Імʼя» (US-02) and the brand's contact person («Ваше імʼя»,
 * «Контактна особа»). Required, 1–50 characters after trimming, not only spaces, no control
 * characters (@DisplayName on the backend).
 */
const personName = z
  .string()
  .trim()
  .min(1, { message: buyerAuthTexts.nameRequired, abort: true })
  .refine(
    (name) => codePointLength(name) <= NAME_MAX && !/\p{Cc}/u.test(name),
    buyerAuthTexts.nameInvalid,
  );

/**
 * Brand registration (US-21): fields in form order — contact name, brand name, website, email,
 * password.
 */
export const brandRegisterSchema = z.object({
  contactName: personName,
  name: brandName,
  websiteUrl: z
    .string()
    .transform(normalizeWebsiteUrl)
    .refine(isWebsiteUrl, websiteUrlInvalidMessage),
  email: newAccountEmail,
  password: newAccountPassword,
});

export type BrandRegisterForm = z.infer<typeof brandRegisterSchema>;

/** The login email (ADR-0018): «Введіть email» when empty, «Перевірте формат email» otherwise. */
const loginEmail = z
  .string()
  .trim()
  .min(1, { message: loginTexts.emailRequired, abort: true })
  .max(EMAIL_MAX, loginTexts.emailFormat)
  .regex(EMAIL, loginTexts.emailFormat);

/**
 * Brand login (US-21.1): «Назва бренду» (2026-12-02), email and password, each error under its
 * own field (ADR-0018). The name: 1–50 characters after trimming, not only spaces. The password
 * only must not be empty: the server says whether it is right.
 */
export const brandLoginSchema = z.object({
  brandName: z
    .string()
    .trim()
    .min(1, { message: loginTexts.brandNameRequired, abort: true })
    .refine(
      (name) => codePointLength(name) <= NAME_MAX,
      loginTexts.brandNameTooLong,
    ),
  email: loginEmail,
  password: z.string().min(1, loginTexts.passwordRequired),
});

export type BrandLoginForm = z.infer<typeof brandLoginSchema>;

/**
 * Buyer login (US-03): «Ваше імʼя», an email of the right shape and a non-empty password, each
 * error under its own field. The server (once it exists) says which one is wrong (ADR-0018).
 */
export const buyerLoginSchema = z.object({
  // «Ваше імʼя» (2026-12-02): the rule of the name at registration (1–50, not only spaces).
  name: personName,
  // An empty field gets only «Введіть email», not the format message as well.
  email: loginEmail,
  password: z.string().min(1, loginTexts.passwordRequired),
});

export type BuyerLoginForm = z.infer<typeof buyerLoginSchema>;

/**
 * Buyer registration (US-02, ADR-0016): the name, «Email або номер телефону», the
 * password with the brand's rules, and «Підтвердити пароль».
 */
export const buyerRegisterSchema = z
  .object({
    // «Імʼя»: required, 1–50 characters after trimming, not only spaces (@DisplayName).
    name: personName,
    // «Email або номер телефону»: the same rules as the server (shared/loginId.ts).
    login: z
      .string()
      .refine(
        (login) => parseLoginId(login) !== null,
        buyerAuthTexts.loginInvalid,
      ),
    password: newAccountPassword,
    confirmPassword: z.string().min(1, buyerAuthTexts.confirmRequired),
  })
  .refine(
    ({ password, confirmPassword }) =>
      confirmPassword === "" || password === confirmPassword,
    {
      message: buyerAuthTexts.passwordsMismatch,
      path: ["confirmPassword"],
      // Also when another field is invalid, so every error shows after one submit.
      when: (payload) => {
        const value = payload.value as Partial<Record<string, unknown>>;
        return (
          typeof value.password === "string" &&
          typeof value.confirmPassword === "string"
        );
      },
    },
  );

export type BuyerRegisterForm = z.infer<typeof buyerRegisterSchema>;

/** Brand name in the profile (US-22.1): the same rule as at registration. */
export const brandNameSchema = z.object({
  name: brandName,
});

/**
 * «Забули пароль?» (/forgot-password): the brand's email (strict format) or, for a buyer,
 * «Email або номер телефону» (parseLoginId, the same rule as /register).
 */
export const forgotPasswordSchemas = {
  brand: z.object({
    login: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, { message: buyerAuthTexts.emailRequired, abort: true })
      .max(EMAIL_MAX, buyerAuthTexts.emailInvalid)
      .regex(EMAIL, buyerAuthTexts.emailInvalid),
  }),
  buyer: z.object({
    login: z
      .string()
      .trim()
      .min(1, { message: buyerAuthTexts.loginRequired, abort: true })
      .refine(
        (login) => parseLoginId(login) !== null,
        buyerAuthTexts.loginInvalid,
      ),
  }),
} as const;

export type ForgotPasswordForm = { login: string };

/** The website in the profile: optional (empty = none), otherwise the registration rule. */
export const optionalWebsiteUrl = z
  .string()
  .transform(normalizeWebsiteUrl)
  .refine(
    (value) => value === "" || isWebsiteUrl(value),
    websiteUrlInvalidMessage,
  );

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

/** Same as WebsiteUrlValidator.MAX_LENGTH on the backend. */
export const WEBSITE_URL_MAX = 2048;
const DOMAIN_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;

/**
 * The brand's website (US-21, @WebsiteUrl): lowercase https://, a URL java.net.URI accepts,
 * a host that is a domain name (two or more labels, the last starting with a letter — not
 * localhost or an IP) and at most 2048 characters. Examples: validation.examples.json.
 */
export function isWebsiteUrl(value: string): boolean {
  if (value.length > WEBSITE_URL_MAX || !isHttpsUrl(value)) return false;
  const authority = URI_PARTS.exec(value)?.[2] ?? "";
  const hostPort = authority.slice(authority.indexOf("@") + 1);
  const host = hostPort.replace(/:\d*$/, "").replace(/\.$/, "");
  const labels = host.split(".");
  return (
    labels.length >= 2 &&
    labels.every((label) => DOMAIN_LABEL.test(label)) &&
    /^[A-Za-z]/.test(labels[labels.length - 1] ?? "")
  );
}

/**
 * «brand.com.ua» → «https://brand.com.ua» when the field loses focus. Only a value without any
 * scheme gets it; «http://…» stays as typed, so the error explains what is wrong.
 */
export function withHttps(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "" || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

/** Query parameters that only track the visit: never part of the brand's own address. */
function isTrackingParam(pair: string): boolean {
  const key = (pair.split("=")[0] ?? "").toLowerCase();
  return (
    key === "srsltid" ||
    key === "fbclid" ||
    key === "gclid" ||
    key.startsWith("utm_")
  );
}

/**
 * The website as it is checked and saved — the same as WebsiteUrlValidator.normalize on the
 * backend (examples: validation.examples.json, «websiteUrlNormalized»): spaces trimmed and the
 * tracking parameters (srsltid, fbclid, gclid, utm_*) removed; other parameters, the path and
 * a #fragment stay; a «?» left with nothing after it goes too.
 */
export function normalizeWebsiteUrl(value: string): string {
  const url = value.trim();
  const hashIndex = url.indexOf("#");
  const base = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? "" : url.slice(hashIndex);
  const queryIndex = base.indexOf("?");
  if (queryIndex === -1) return url;
  const kept = base
    .slice(queryIndex + 1)
    .split("&")
    .filter((pair) => pair !== "" && !isTrackingParam(pair));
  const query = kept.length > 0 ? `?${kept.join("&")}` : "";
  return `${base.slice(0, queryIndex)}${query}${fragment}`;
}

/**
 * What the «Сайт бренду» field shows after it loses focus: https:// added to a bare domain
 * (withHttps), then the tracking parameters removed (normalizeWebsiteUrl).
 */
export function cleanWebsiteUrl(value: string): string {
  return normalizeWebsiteUrl(withHttps(value));
}

/** Whole positive number of UAH typed into the price field. */
export function isValidPrice(value: string): boolean {
  if (!/^\d+$/.test(value)) return false;
  const price = Number(value);
  return price > 0 && price <= PRICE_MAX_UAH;
}

const photoObject = z.object({
  file: z.custom<File>((value) => value instanceof File).nullable(),
  url: z.string().trim(),
});

/**
 * Exactly one of: an uploaded file or an https:// image URL (api.md §4.1). When editing a card
 * whose photo is an uploaded image, neither may be given: the current image stays.
 */
function isValidPhoto(
  { file, url }: z.infer<typeof photoObject>,
  keepsUploadedPhoto: boolean,
): boolean {
  if (file !== null && url !== "") return false;
  if (file !== null) {
    return (
      IMAGE_MIME_TYPES.includes(file.type) &&
      file.size > 0 &&
      file.size <= IMAGE_MAX_BYTES
    );
  }
  if (url === "") return keepsUploadedPhoto;
  return isHttpsUrl(url);
}

const photoSchema = photoObject.refine((photo) => isValidPhoto(photo, false), {
  message: PRICE_OR_PHOTO,
});

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

/**
 * The card form when editing (US-26 S1): the same rules, but a card whose photo is an uploaded
 * image may keep it (no new file, no URL).
 */
export function editCardFormSchema(keepsUploadedPhoto: boolean) {
  return cardFormSchema.extend({
    photo: photoObject.refine(
      (photo) => isValidPhoto(photo, keepsUploadedPhoto),
      { message: PRICE_OR_PHOTO },
    ),
  });
}
