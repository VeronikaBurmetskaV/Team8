import { useMutation } from "@tanstack/react-query";
import type { LoginTab } from "./loginTabs";

/** One press of «Надіслати» on /forgot-password. */
export interface PasswordResetRequest {
  /** Whose password: the buyer's or the brand's (`for` of the page). */
  for: LoginTab;
  /** The email (brand) or «Email або номер телефону» (buyer), already checked by the form. */
  login: string;
}

/** The outcome of «Надіслати»: for now always the stub («скоро тут можна буде…»). */
export type PasswordResetResult = { status: "soon" };

/**
 * Password reset is out of the MVP (CLAUDE.md §1.2: «password reset by email» is postponed),
 * and the server has no endpoint for it, so nothing is sent: the page shows the stub message.
 *
 * TODO: підключити ендпоінт відновлення пароля — apiPost to the documented endpoint once it
 * exists (a new ADR + api.md). Only this function and useRequestPasswordReset need to change;
 * the page already handles the pending state and errors of a real request.
 */
export function requestPasswordReset(
  request: PasswordResetRequest,
): Promise<PasswordResetResult> {
  void request;
  return Promise.resolve({ status: "soon" });
}

export function useRequestPasswordReset() {
  return useMutation({ mutationFn: requestPasswordReset });
}
