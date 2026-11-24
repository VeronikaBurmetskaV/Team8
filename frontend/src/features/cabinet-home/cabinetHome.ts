import type { BrandCard } from "../../api/types";

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
