import { describe, expect, it } from "vitest";
import { formatPrice } from "./price";

describe("formatPrice", () => {
  it("adds «грн» without a thousands separator (US-08.2 CL)", () => {
    expect(formatPrice(2400)).toBe("2400 грн");
    expect(formatPrice(125000)).toBe("125000 грн");
  });

  it("keeps small prices as they are", () => {
    expect(formatPrice(1)).toBe("1 грн");
  });

  it("never prints a fraction", () => {
    expect(formatPrice(2399.6)).toBe("2400 грн");
  });
});
