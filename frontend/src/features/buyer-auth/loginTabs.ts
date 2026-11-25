import type { ErrorCode } from "../../api/types";
import { errorCodeOf, errorMessage } from "../../shared/errors";
import { loginTexts, messages } from "../../shared/messages.uk";

/**
 * The two tabs of /login. The active one lives in the URL: /login = buyer (default),
 * /login?tab=brand = brand, so a reload or a shared link keeps it.
 */
export const LOGIN_TABS = ["buyer", "brand"] as const;
export type LoginTab = (typeof LOGIN_TABS)[number];

/** Any value other than "brand" (missing, misspelt) means the default buyer tab. */
export function parseLoginTab(search: URLSearchParams): LoginTab {
  return search.get("tab") === "brand" ? "brand" : "buyer";
}

/** The address of a tab: "/login" or "/login?tab=brand". */
export function loginPath(tab: LoginTab): string {
  return tab === "brand" ? "/login?tab=brand" : "/login";
}

/**
 * «Забули пароль?» of a tab: /forgot-password?for=buyer or /forgot-password?for=brand. The
 * page reads `for` with parseLoginTab-like rules (parseResetFor) and leads back to that tab.
 */
export function forgotPasswordPath(tab: LoginTab): string {
  return `/forgot-password?for=${tab}`;
}

/** The inputs of the two login forms that a server error can point at (ADR-0018). */
export type LoginErrorField = "brandName" | "name" | "email" | "password";

/** Where a failed login is shown: under one field (and focused), or once for the form. */
export type LoginError =
  | { field: LoginErrorField; code: ErrorCode; message: string }
  | { field: null; code: ErrorCode; message: string };

/**
 * The answer of a failed login (ADR-0018), checked in this order on the server: an unknown email
 * → under «Email» (with «Зареєструватися»), a wrong password → under «Пароль» (next to «Забули
 * пароль?»), a name that differs → under «Назва бренду» / «Ваше імʼя». 429 and anything
 * unexpected → one message for the form.
 */
export function loginError(error: unknown, tab: LoginTab): LoginError {
  const code = errorCodeOf(error);
  switch (code) {
    case "EMAIL_NOT_FOUND":
      return { field: "email", code, message: messages[code] };
    case "WRONG_PASSWORD":
      return { field: "password", code, message: messages[code] };
    case "BRAND_NAME_MISMATCH":
      return tab === "brand"
        ? { field: "brandName", code, message: messages[code] }
        : { field: null, code, message: messages[code] };
    case "NAME_MISMATCH":
      return tab === "buyer"
        ? { field: "name", code, message: messages[code] }
        : { field: null, code, message: messages[code] };
    case "TOO_MANY_REQUESTS":
      return { field: null, code, message: loginTexts.tooManyAttempts };
    default:
      return { field: null, code, message: errorMessage(error) };
  }
}

/**
 * Puts a failed login on the form: under its field, with the focus there, or once for the form
 * («root»). The error's `type` is the code, so the page can add «Зареєструватися» next to
 * EMAIL_NOT_FOUND. `F` = the fields of that form.
 */
export function showLoginError<F extends LoginErrorField>(
  error: unknown,
  tab: LoginTab,
  setError: (
    name: F | "root",
    error: { type: string; message: string },
    options?: { shouldFocus: boolean },
  ) => void,
): void {
  const { field, code, message } = loginError(error, tab);
  if (field === null) {
    setError("root", { type: code, message });
  } else {
    setError(field as F, { type: code, message }, { shouldFocus: true });
  }
}

/** «Зареєструватися» next to EMAIL_NOT_FOUND: the registration of that tab. */
export function registerPath(tab: LoginTab): string {
  return tab === "brand" ? "/brand/register" : "/register";
}

/** `for` of /forgot-password: "brand" for the brand, anything else (missing, misspelt) = buyer. */
export function parseResetFor(search: URLSearchParams): LoginTab {
  return search.get("for") === "brand" ? "brand" : "buyer";
}

/**
 * WAI-ARIA tabs keyboard: ←/→ move to the other tab (wrapping), Home/End to the first/last.
 * Returns null for keys the tablist does not handle.
 */
export function tabForKey(key: string, current: LoginTab): LoginTab | null {
  const index = LOGIN_TABS.indexOf(current);
  const last = LOGIN_TABS.length - 1;
  let next: number;
  switch (key) {
    case "ArrowRight":
      next = index === last ? 0 : index + 1;
      break;
    case "ArrowLeft":
      next = index === 0 ? last : index - 1;
      break;
    case "Home":
      next = 0;
      break;
    case "End":
      next = last;
      break;
    default:
      return null;
  }
  return LOGIN_TABS[next] ?? null;
}
