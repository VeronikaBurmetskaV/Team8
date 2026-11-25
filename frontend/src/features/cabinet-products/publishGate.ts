import type { BrandCard, ProfileState } from "../../api/types";

/** What the product list shows for the «Опублікувати у стрічку» button of one card. */
export type PublishGate =
  /** The card is already PUBLISHED: no button. */
  | { kind: "hidden" }
  /** «Немає на сайті» (ADR-0017): disabled with «Цього товару більше немає на сайті бренду». */
  | { kind: "notOnSite" }
  /** The profile is still loading (or failed): the button is disabled, no hint. */
  | { kind: "loading" }
  /** No consent yet (ACTIVE or INCOMPLETE): the button is disabled with the hint (US-31 S2). */
  | { kind: "consentRequired" }
  /** The button can be pressed. */
  | { kind: "ready" };

/**
 * UX only: the server decides with one conditional UPDATE and answers 409 CONSENT_REQUIRED
 * anyway (ADR-0009). Fields are not checked here: a draft is always complete (G-02).
 */
export function publishGate(
  card: BrandCard,
  profileState: ProfileState | null,
): PublishGate {
  if (card.status === "PUBLISHED") return { kind: "hidden" };
  // Before the consent: publishing it can't help, whatever the profile (409 PRODUCT_NOT_ON_SITE).
  if (typeof card.notOnSiteSince === "string") return { kind: "notOnSite" };
  if (profileState === null) return { kind: "loading" };
  if (profileState !== "CONSENTED") return { kind: "consentRequired" };
  return { kind: "ready" };
}
