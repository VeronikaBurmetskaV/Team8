import type { BrandCard } from "../../api/types";
import type { CardFormValues } from "../../shared/validation";

/** «Немає на сайті» (ADR-0017): a complete sync no longer finds it on the brand's site. */
export function isNotOnSite(card: BrandCard): boolean {
  return typeof card.notOnSiteSince === "string";
}

/** What the row says under the price. */
export type DisplayStatus = "DRAFT" | "PUBLISHED" | "NOT_ON_SITE";

export function displayStatus(card: BrandCard): DisplayStatus {
  return isNotOnSite(card) ? "NOT_ON_SITE" : card.status;
}

/** A row with a selection circle: every card but «Немає на сайті» (drafts and published). */
export function isSelectable(card: BrandCard): boolean {
  return !isNotOnSite(card);
}

/** A draft «Опублікувати всі чернетки» / «Опублікувати вибрані» can publish. */
export function isPublishable(card: BrandCard): boolean {
  return card.status === "DRAFT" && !isNotOnSite(card);
}

/** IDs of the shown cards that have a selection circle: what «вибрати всі» selects. */
export function selectableIds(cards: readonly BrandCard[]): string[] {
  return cards.filter(isSelectable).map((card) => card.id);
}

/** «Зняти вибрані з публікації»: the selected published cards that are still shown. */
export function selectedPublished(
  selected: ReadonlySet<string>,
  shown: readonly BrandCard[],
): string[] {
  return shown
    .filter((card) => card.status === "PUBLISHED" && selected.has(card.id))
    .map((card) => card.id);
}

/** What «Зняти» in the confirmation unpublishes: one row's card, or the selected ones. */
export type UnpublishRequest = { ids: string[]; bulk: boolean } | null;

/**
 * The answer of the confirmation: «Зняти» sends the request (one card or many), «Скасувати»
 * sends nothing. Either way the dialog closes (the caller sets the request back to null).
 */
export function answerUnpublish(
  request: UnpublishRequest,
  confirmed: boolean,
  send: { one: (id: string) => void; many: (ids: string[]) => void },
): void {
  if (!confirmed || request === null || request.ids.length === 0) return;
  const [first] = request.ids;
  if (!request.bulk && first !== undefined) send.one(first);
  else send.many(request.ids);
}

/**
 * The list order: drafts and published cards as the server sends them (newest first), then the
 * «Немає на сайті» ones (the server sends them last too; the sort is stable).
 */
export function listOrder(cards: readonly BrandCard[]): BrandCard[] {
  return [...cards].sort(
    (a, b) => Number(isNotOnSite(a)) - Number(isNotOnSite(b)),
  );
}

/** IDs of the drafts among the shown cards that can be published: «Опублікувати всі». */
export function draftIds(cards: readonly BrandCard[]): string[] {
  return cards.filter(isPublishable).map((card) => card.id);
}

/** Adds or removes one ID; a new set, so React sees the change. */
export function toggle(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/**
 * «Вибрати всі»: selects every shown card with a circle, or clears them when all are already
 * selected. Selections outside them are kept.
 */
export function toggleAll(
  selected: ReadonlySet<string>,
  shownIds: readonly string[],
): Set<string> {
  const allSelected =
    shownIds.length > 0 && shownIds.every((id) => selected.has(id));
  const next = new Set(selected);
  for (const id of shownIds) {
    if (allSelected) next.delete(id);
    else next.add(id);
  }
  return next;
}

/**
 * «Опублікувати вибрані»: the selected drafts that are still shown, in list order. A selected
 * card that became «Немає на сайті» after a sync stays in it, so the page can report it as
 * skipped (splitNotOnSite) instead of dropping it silently.
 */
export function selectedDrafts(
  selected: ReadonlySet<string>,
  shown: readonly BrandCard[],
): string[] {
  return shown
    .filter((card) => card.status === "DRAFT" && selected.has(card.id))
    .map((card) => card.id);
}

/**
 * Splits the IDs to publish: the ones to send, and the «Немає на сайті» ones that are skipped
 * without a request (the server would skip them anyway, ADR-0017).
 */
export function splitNotOnSite(
  ids: readonly string[],
  cards: readonly BrandCard[],
): { publish: string[]; notOnSite: string[] } {
  const missing = new Set(cards.filter(isNotOnSite).map((card) => card.id));
  return {
    publish: ids.filter((id) => !missing.has(id)),
    notOnSite: ids.filter((id) => missing.has(id)),
  };
}

/**
 * Whether a click on the row should toggle its selection: not when it lands on a link, a
 * button or a form control (they do their own thing; the checkbox toggles itself).
 */
export function rowClickToggles(
  target: { closest?: (selector: string) => unknown } | null,
): boolean {
  if (typeof target?.closest !== "function") return true;
  return target.closest("a, button, input, select, textarea, label") === null;
}

/** The editor's starting values. An uploaded photo is kept as it is: no file, no URL. */
export function toCardFormValues(card: BrandCard): CardFormValues {
  return {
    name: card.name,
    priceUah: String(card.priceUah),
    photo: {
      file: null,
      url: card.photoImageId === null ? card.photoUrl : "",
    },
    productUrl: card.productUrl,
  };
}
