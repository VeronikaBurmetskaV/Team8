import { describe, expect, it } from "vitest";
import type { BrandCard } from "../../api/types";
import { summarizeProducts } from "./cabinetHome";

function card(id: string, status: BrandCard["status"]): BrandCard {
  return { id, status } as BrandCard;
}

describe("summarizeProducts", () => {
  it("counts all, published and draft cards", () => {
    expect(
      summarizeProducts([
        card("1", "PUBLISHED"),
        card("2", "DRAFT"),
        card("3", "PUBLISHED"),
      ]),
    ).toEqual({ total: 3, published: 2, drafts: 1 });
  });

  it("is all zeros without cards", () => {
    expect(summarizeProducts([])).toEqual({
      total: 0,
      published: 0,
      drafts: 0,
    });
  });
});
