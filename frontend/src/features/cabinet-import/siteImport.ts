import type { BrandProfileResponse, ImportStatus } from "../../api/types";

/** Which step of «Імпорт з сайту» the brand is on (ADR-0017). */
export type ImportStep = "no-website" | "loading" | "verify" | "ready";

/**
 * Whether the server requires the ownership check, from the import status only: `null` while
 * the status is not loaded yet. A status without the field (an older backend) or a failed load
 * counts as «required» — the safe side; the server decides anyway.
 */
export function verificationRequired(
  status: ImportStatus | null | undefined,
  loading: boolean,
): boolean | null {
  if (status) return status.verificationRequired !== false;
  return loading ? null : true;
}

/**
 * The step to show. In demo mode (`required === false`) there is no verification step: a
 * website in the profile is enough.
 */
export function importStep(
  profile: BrandProfileResponse,
  required: boolean | null,
): ImportStep {
  // Truthiness, not `=== null`: a raw answer of an older backend leaves the keys out.
  if (!profile.websiteUrl) return "no-website";
  if (required === null) return "loading";
  if (!required) return "ready";
  return profile.siteDomain ? "ready" : "verify";
}

/**
 * The domain the brand verifies: the website's host without «www.», like the server's
 * SiteDomain (the server is the authority; this is only for the texts).
 */
export function websiteDomain(websiteUrl: string | null): string | null {
  if (!websiteUrl) return null;
  try {
    const host = new URL(websiteUrl).hostname.toLowerCase().replace(/\.$/, "");
    return host.startsWith("www.") && host.indexOf(".", 4) > 0
      ? host.slice(4)
      : host;
  } catch {
    return null;
  }
}

/** The exact tag the server looks for on the home page. */
export function verificationMetaTag(token: string): string {
  return `<meta name="fulla-verification" content="${token}">`;
}

export const VERIFICATION_FILE_NAME = "fulla-verification.txt";

/** The file's content: only the token (a final newline is ignored by the server). */
export function verificationFileText(token: string): string {
  return `${token}\n`;
}

export function isRunning(status: ImportStatus | null | undefined): boolean {
  return status?.status === "RUNNING";
}

/**
 * The feed must be an https:// link on the website's domain or a subdomain (api.md, PUT
 * profile `feedUrl`); empty means no feed.
 */
export function isFeedUrlOnSite(value: string, domain: string): boolean {
  const url = value.trim();
  if (url === "") return true;
  if (!url.startsWith("https://")) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}

const dateTime = new Intl.DateTimeFormat("uk-UA", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Kyiv",
});

const time = new Intl.DateTimeFormat("uk-UA", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Kyiv",
});

/** «25.11.2026, 18:20» in Kyiv time. */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

/** «18:30» in Kyiv time. */
export function formatTime(iso: string): string {
  return time.format(new Date(iso));
}

/** The next import may start only after `nextAllowedAt` (one import per 10 minutes). */
export function waitUntil(
  status: ImportStatus | null | undefined,
  now: number,
): string | null {
  const next = status?.nextAllowedAt;
  if (!next || isRunning(status)) return null;
  return new Date(next).getTime() > now ? next : null;
}
