import { describe, expect, it } from "vitest";
import { withUtm } from "./links";

describe("withUtm", () => {
  it("adds utm_source to a URL without a query", () => {
    expect(withUtm("https://brand.ua/item/1")).toBe(
      "https://brand.ua/item/1?utm_source=fulla",
    );
  });

  it("appends with & when a query exists", () => {
    expect(withUtm("https://brand.ua/item?id=7")).toBe(
      "https://brand.ua/item?id=7&utm_source=fulla",
    );
  });

  it("puts the parameter before the fragment", () => {
    expect(withUtm("http://brand.ua/item?id=7#sizes")).toBe(
      "http://brand.ua/item?id=7&utm_source=fulla#sizes",
    );
  });

  it("handles an empty query", () => {
    expect(withUtm("https://brand.ua/item?")).toBe(
      "https://brand.ua/item?utm_source=fulla",
    );
  });

  it("keeps an existing utm_source unchanged", () => {
    const url = "https://brand.ua/item?utm_source=insta&x=1";
    expect(withUtm(url)).toBe(url);
  });

  it("rejects anything that is not http(s)", () => {
    expect(withUtm("javascript:alert(1)")).toBeNull();
    expect(withUtm("data:text/html,hi")).toBeNull();
    expect(withUtm("brand.ua/item")).toBeNull();
  });

  it.each([undefined, null, "", "   "])(
    "gives no link (and does not throw) for %j",
    (value) => {
      expect(withUtm(value)).toBeNull();
    },
  );

  it("keeps http:// product links (product URLs may be http or https, CLAUDE.md §5.3)", () => {
    expect(withUtm("http://brand.ua")).toBe("http://brand.ua?utm_source=fulla");
    expect(withUtm("https://brand.ua")).toBe(
      "https://brand.ua?utm_source=fulla",
    );
  });
});
