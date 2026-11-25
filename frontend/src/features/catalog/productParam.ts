import type { FeedCard } from "../../api/types";

/** ?product=<id>: the full card open over the catalogue; a link to it can be shared. */
export const PRODUCT_PARAM = "product";

/** history state of the entry that opening the card pushed: «×» then goes back to the page. */
export interface ProductModalState {
  productModal: true;
}

/** The address with the card open: the same filters, plus ?product=<id>. */
export function withProduct(
  params: URLSearchParams,
  id: string,
): URLSearchParams {
  const next = new URLSearchParams(params);
  next.set(PRODUCT_PARAM, id);
  return next;
}

/** The address without the card: the filters stay as they are. */
export function withoutProduct(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete(PRODUCT_PARAM);
  return next;
}

/** The card of ?product=<id> when the catalogue has it; otherwise null (the param is ignored). */
export function productOfUrl(
  params: URLSearchParams,
  items: readonly FeedCard[],
): FeedCard | null {
  const id = params.get(PRODUCT_PARAM);
  if (id === null || id === "") return null;
  return items.find((card) => card.id === id) ?? null;
}

/**
 * How «×», Esc and the backdrop close the card. Opened from the page (a pushed history entry):
 * one step back, so «Назад» afterwards does not reopen it. Opened from a link (?product= in
 * the address the page started with): the param is removed in place.
 */
export function closeAction(
  state: unknown,
  params: URLSearchParams,
): { kind: "back" } | { kind: "replace"; params: URLSearchParams } {
  const pushed =
    typeof state === "object" &&
    state !== null &&
    (state as Partial<ProductModalState>).productModal === true;
  return pushed
    ? { kind: "back" }
    : { kind: "replace", params: withoutProduct(params) };
}
