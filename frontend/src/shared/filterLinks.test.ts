import { describe, expect, it } from "vitest";
import { filterParamsOf, withFilterParams } from "./filterLinks";

describe("links between / and /feed keep the filters", () => {
  it("copies only the filter parameters, in their order", () => {
    const search =
      "?utm_source=x&maxPrice=2500&brand=mint&tab=brand&brand=cher%2717";
    expect(filterParamsOf(search).toString()).toBe(
      "maxPrice=2500&brand=mint&brand=cher%2717",
    );
  });

  it("/ → /feed → / keeps the same filters", () => {
    const onHome = "?minPrice=500&maxPrice=2500&brand=one+by+one";
    const toFeed = withFilterParams("/feed", onHome);
    expect(toFeed).toBe("/feed?minPrice=500&maxPrice=2500&brand=one+by+one");
    const back = withFilterParams("/", new URL(toFeed, "http://x").search);
    expect(back).toBe("/?minPrice=500&maxPrice=2500&brand=one+by+one");
  });

  it("a page without filters links to the plain address", () => {
    expect(withFilterParams("/feed", "")).toBe("/feed");
    expect(withFilterParams("/", "?tab=brand")).toBe("/");
  });
});
