import { describe, expect, it } from "vitest";
import type { BrandCard } from "../../api/types";
import { publishGate } from "./publishGate";

const card = (status: BrandCard["status"]) =>
  ({ id: "1", status }) as BrandCard;

describe("publishGate", () => {
  it("hides the button for a PUBLISHED card", () => {
    expect(publishGate(card("PUBLISHED"), "CONSENTED")).toEqual({
      kind: "hidden",
    });
    expect(publishGate(card("PUBLISHED"), null)).toEqual({ kind: "hidden" });
  });

  it("disables a «Немає на сайті» card whatever the profile (ADR-0017)", () => {
    const gone = { ...card("DRAFT"), notOnSiteSince: "2026-11-30T10:00:00Z" };
    expect(publishGate(gone, "CONSENTED")).toEqual({ kind: "notOnSite" });
    expect(publishGate(gone, null)).toEqual({ kind: "notOnSite" });
  });

  it("waits while the profile is not loaded", () => {
    expect(publishGate(card("DRAFT"), null)).toEqual({ kind: "loading" });
  });

  it("requires consent for INCOMPLETE and ACTIVE profiles (US-31 S2)", () => {
    expect(publishGate(card("DRAFT"), "INCOMPLETE")).toEqual({
      kind: "consentRequired",
    });
    expect(publishGate(card("DRAFT"), "ACTIVE")).toEqual({
      kind: "consentRequired",
    });
  });

  it("lets a CONSENTED brand publish a draft", () => {
    expect(publishGate(card("DRAFT"), "CONSENTED")).toEqual({ kind: "ready" });
  });
});
