/** The brand cabinet home page (/brand). */
export const BRAND_HOME_PATH = "/brand";

/**
 * Where a brand lands after login or registration: always the cabinet home page. It shows
 * the way to the profile itself while the brand has no name (US-21 CL, US-21.1 CL).
 */
export function pathAfterLogin(): string {
  return BRAND_HOME_PATH;
}
