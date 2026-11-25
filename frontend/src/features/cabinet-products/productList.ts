import type { BrandCard } from "../../api/types";
import type { CardFormValues } from "../../shared/validation";

/** The list filter of /brand/products, kept in `?filter=` so a link can open it. */
export type ProductFilter = "all" | "imported-drafts";

export function parseFilter(value: string | null): ProductFilter {
  return value === "imported" ? "imported-drafts" : "all";
}

export function filterParam(filter: ProductFilter): string | null {
  return filter === "imported-drafts" ? "imported" : null;
}

/** A card imported from the brand's site (ADR-0017): only those carry `sourceUrl`. */
export function isImported(card: BrandCard): boolean {
  return typeof card.sourceUrl === "string";
}

export function filterCards(
  cards: readonly BrandCard[],
  filter: ProductFilter,
): BrandCard[] {
  if (filter === "all") return [...cards];
  return cards.filter((card) => isImported(card) && card.status === "DRAFT");
}

/** IDs of the drafts among the shown cards: what «Опублікувати всі» publishes. */
export function draftIds(cards: readonly BrandCard[]): string[] {
  return cards.filter((card) => card.status === "DRAFT").map((card) => card.id);
}

/** Adds or removes one ID; a new set, so React sees the change. */
export function toggle(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/**
 * «Вибрати всі»: selects every shown draft, or clears them when all are already selected.
 * Selections outside the shown drafts are kept.
 */
export function toggleAll(
  selected: ReadonlySet<string>,
  shownDrafts: readonly string[],
): Set<string> {
  const allSelected =
    shownDrafts.length > 0 && shownDrafts.every((id) => selected.has(id));
  const next = new Set(selected);
  for (const id of shownDrafts) {
    if (allSelected) next.delete(id);
    else next.add(id);
  }
  return next;
}

/** Only drafts that are still shown can be published from the selection. */
export function selectedDrafts(
  selected: ReadonlySet<string>,
  shownDrafts: readonly string[],
): string[] {
  return shownDrafts.filter((id) => selected.has(id));
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
