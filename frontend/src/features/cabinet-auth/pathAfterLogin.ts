import type { ProfileState } from "../../api/types";

/**
 * Where a brand lands after login or registration: the profile first while it has
 * no name, otherwise the products (US-21 CL, US-21.1 CL).
 */
export function pathAfterLogin(profileState: ProfileState): string {
  return profileState === "INCOMPLETE" ? "/brand/profile" : "/brand/products";
}
