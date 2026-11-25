import type { BrandCard, BrandProfileResponse } from "../../api/types";
import { withUtm } from "../../shared/links";

export type ProductSummary = {
  total: number;
  published: number;
  drafts: number;
};

/** Counts for the «Товари» card of the cabinet home page. */
export function summarizeProducts(cards: readonly BrandCard[]): ProductSummary {
  const published = cards.filter((card) => card.status === "PUBLISHED").length;
  return { total: cards.length, published, drafts: cards.length - published };
}

/**
 * Which notices the home page shows (domain-model.md §4.1):
 * - no name (INCOMPLETE, accounts from before names were asked at registration): «Спочатку
 *   збережіть назву бренду», and «Додати товар» is off — a card needs a saved name (T-2);
 * - a name but no consent (ACTIVE): publishing is refused (409 CONSENT_REQUIRED, T-1), so
 *   buyers see none of the brand's products. Consent needs a name first, so this notice is not
 *   shown together with the name one.
 */
export function homeNotices(profile: BrandProfileResponse): {
  needsName: boolean;
  needsConsent: boolean;
} {
  const needsName = profile.name === null;
  return { needsName, needsConsent: !needsName && !profile.consentGiven };
}

/**
 * The brand's own website for the profile header: the visible text without «https://» and a
 * trailing «/», the link through withUtm (the only builder of outbound links, CLAUDE.md §6).
 * Only an `https://` address is a website (api.md §2.1, the WebsiteUrl rule); null, undefined,
 * an empty or blank value and `http://` give null — no link, never an exception.
 */
export function websiteLink(
  websiteUrl: string | null | undefined,
): { href: string; text: string } | null {
  if (typeof websiteUrl !== "string") return null;
  const url = websiteUrl.trim();
  if (!/^https:\/\/\S/i.test(url)) return null;
  const href = withUtm(url);
  if (href === null) return null;
  const text = url.replace(/^https:\/\//i, "").replace(/\/$/, "");
  return { href, text };
}
