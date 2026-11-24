import { describe, expect, it } from "vitest";
import { loginPath, parseLoginTab, tabForKey } from "./loginTabs";

describe("login tab in the URL", () => {
  it("is the buyer tab by default", () => {
    expect(parseLoginTab(new URLSearchParams(""))).toBe("buyer");
  });

  it("is the brand tab for ?tab=brand", () => {
    expect(parseLoginTab(new URLSearchParams("?tab=brand"))).toBe("brand");
  });

  it("falls back to the buyer tab for an unknown value", () => {
    expect(parseLoginTab(new URLSearchParams("?tab=admin"))).toBe("buyer");
  });

  it("round-trips through the address of each tab", () => {
    for (const tab of ["buyer", "brand"] as const) {
      const search = new URL(loginPath(tab), "http://x").searchParams;
      expect(parseLoginTab(search)).toBe(tab);
    }
    expect(loginPath("buyer")).toBe("/login");
    expect(loginPath("brand")).toBe("/login?tab=brand");
  });
});

describe("switching tabs with the keyboard", () => {
  it("moves with the arrows and wraps around", () => {
    expect(tabForKey("ArrowRight", "buyer")).toBe("brand");
    expect(tabForKey("ArrowRight", "brand")).toBe("buyer");
    expect(tabForKey("ArrowLeft", "brand")).toBe("buyer");
    expect(tabForKey("ArrowLeft", "buyer")).toBe("brand");
  });

  it("jumps to the first and last tab with Home and End", () => {
    expect(tabForKey("Home", "brand")).toBe("buyer");
    expect(tabForKey("End", "buyer")).toBe("brand");
  });

  it("ignores other keys", () => {
    expect(tabForKey("Enter", "buyer")).toBeNull();
    expect(tabForKey("a", "brand")).toBeNull();
  });
});
