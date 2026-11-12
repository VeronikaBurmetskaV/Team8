import { describe, expect, it } from "vitest";
import { pathAfterLogin } from "./pathAfterLogin";

describe("pathAfterLogin", () => {
  it("sends a brand without a name to the profile", () => {
    expect(pathAfterLogin("INCOMPLETE")).toBe("/brand/profile");
  });

  it.each(["ACTIVE", "CONSENTED"] as const)(
    "sends a brand with the state %s to the products",
    (profileState) => {
      expect(pathAfterLogin(profileState)).toBe("/brand/products");
    },
  );
});
