import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiPost } from "../../api/client";
import type {
  BuyerCredentialsRequest,
  BuyerRegisterRequest,
  BuyerSessionResponse,
  ErrorCode,
} from "../../api/types";
import { toFormErrors } from "../../shared/errors";
import { buyerAuthTexts as t, messages } from "../../shared/messages.uk";
import { resetForNewSession } from "../../shared/session";

/** Where a buyer lands after registration: the home page. */
export const PATH_AFTER_REGISTER = "/";

/**
 * POST /api/buyer/register (US-02, api.md §2.3, ADR-0016): creates the account by email or
 * phone with the name, and logs the buyer in. Only these three fields are sent.
 */
export function registerBuyer(
  body: BuyerRegisterRequest,
): Promise<BuyerSessionResponse> {
  return apiPost<BuyerSessionResponse>("/api/buyer/register", {
    name: body.name.trim(),
    login: body.login,
    password: body.password,
  });
}

export function useRegisterBuyer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: registerBuyer,
    onSuccess: () => resetForNewSession(queryClient),
    // TODO(ADR-0012, US-02): after success send the browser's «Вподобане» with
    // POST /api/me/favorites and replace the local set with the answer.
  });
}

/** What the buyer sees after a failed registration, in Ukrainian; never a raw server text. */
export interface RegisterErrors {
  name?: string;
  login?: string;
  password?: string;
  form?: string;
}

/** A field code of the envelope → the text under that field on /register. */
function fieldText(
  field: "name" | "login" | "password",
  code: ErrorCode,
): string {
  if (field === "login" && code === "EMAIL_TAKEN_OR_INVALID")
    return t.loginTaken;
  if (field === "login" && code === "LOGIN_INVALID") return t.loginInvalid;
  // Empty or longer than 50: the client already checks both, so the server says it only when
  // they differ; the length text covers both («Імʼя — до 50 символів» / «Введіть імʼя»).
  if (field === "name" && code === "VALIDATION_FAILED") return t.nameInvalid;
  return messages[code];
}

/**
 * The error of POST /api/buyer/register spread over the form (api.md §2.3, ADR-0016):
 * LOGIN_INVALID (400) and a taken email or phone (409, one neutral text) → under «Email або
 * номер телефону»; VALIDATION_FAILED on the name → under «Імʼя»; PASSWORD_TOO_SHORT → under
 * «Пароль»; 429 and no connection → one message under the button.
 */
export function registerErrors(error: unknown): RegisterErrors {
  // `fetch` threw: no answer at all.
  if (!(error instanceof ApiError)) return { form: t.network };

  const { fields, form } = toFormErrors(error, {
    name: "name",
    login: "login",
    password: "password",
  } as const);
  const result: RegisterErrors = {};
  if (fields.name) result.name = fieldText("name", fields.name);
  if (fields.login) result.login = fieldText("login", fields.login);
  if (fields.password) result.password = fieldText("password", fields.password);

  switch (form) {
    case null:
      break;
    case "EMAIL_TAKEN_OR_INVALID":
    case "LOGIN_INVALID":
      result.login = fieldText("login", form);
      break;
    case "PASSWORD_TOO_SHORT":
      result.password = messages.PASSWORD_TOO_SHORT;
      break;
    case "TOO_MANY_REQUESTS":
      result.form = t.tooManyAttempts;
      break;
    case "SERVICE_UNAVAILABLE":
      // The proxy answered without the envelope: the backend is not reachable.
      result.form = t.network;
      break;
    default:
      result.form = messages[form];
  }
  return result;
}

/** The outcome of «Створити акаунт»: where to go next, or what to show on the form. */
export type RegisterOutcome =
  { ok: true; next: string } | { ok: false; errors: RegisterErrors };

/** Sends the form (`send` = the mutation) and turns the answer into what the page does next. */
export async function submitRegistration(
  body: BuyerRegisterRequest,
  send: (body: BuyerRegisterRequest) => Promise<unknown>,
): Promise<RegisterOutcome> {
  try {
    await send(body);
    return { ok: true, next: PATH_AFTER_REGISTER };
  } catch (error) {
    return { ok: false, errors: registerErrors(error) };
  }
}

/** The outcome of one press of «Увійти». */
export type BuyerLoginResult = { status: "soon" };

/**
 * The body of the future POST /api/buyer/login (api.md §2.3, 2026-12-02): «Ваше імʼя» trimmed,
 * the email and the password, nothing else.
 */
export function buyerLoginBody(
  credentials: BuyerCredentialsRequest,
): BuyerCredentialsRequest {
  return {
    name: credentials.name.trim(),
    email: credentials.email,
    password: credentials.password,
  };
}

/**
 * Buyer login (US-03). The backend has no POST /api/buyer/login yet, so nothing is sent:
 * the form shows «Вхід для покупців скоро запрацює…». The name is only checked by the form.
 *
 * TODO: підключити POST /api/buyer/login (US-03, api.md §2.3) —
 * apiPost<BuyerSessionResponse>("/api/buyer/login", buyerLoginBody(credentials)) with the name
 * (the server compares it with the account's display_name like the brand name), then
 * resetForNewSession and the merge of «Вподобане» (ADR-0012). Errors (ADR-0018) are already
 * handled by the form: 401 EMAIL_NOT_FOUND / WRONG_PASSWORD / NAME_MISMATCH under their field,
 * 429 once for the form. Only this function and useBuyerLogin need to change.
 */
export function loginBuyer(
  credentials: BuyerCredentialsRequest,
): Promise<BuyerLoginResult> {
  void buyerLoginBody(credentials);
  return Promise.resolve({ status: "soon" });
}

export function useBuyerLogin() {
  return useMutation({ mutationFn: loginBuyer });
}
