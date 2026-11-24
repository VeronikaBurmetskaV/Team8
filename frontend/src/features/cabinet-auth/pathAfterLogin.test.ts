import { describe, expect, it } from "vitest";
import { pathAfterLogin } from "./pathAfterLogin";

describe("pathAfterLogin", () => {
  it("always sends the brand to the cabinet home page", () => {
    expect(pathAfterLogin()).toBe("/brand");
  });
});
