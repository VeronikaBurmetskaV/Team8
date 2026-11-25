import { describe, expect, it } from "vitest";
import examples from "./validation.examples.json";
import { E164, parseLoginId } from "./loginId";

/** The same list as LoginIdTest on the backend (validation.examples.json, «loginId»). */
const loginExamples = examples.loginId as {
  value: string;
  kind: "email" | "phone" | null;
  normalized: string | null;
}[];

describe("parseLoginId: the same examples as LoginId.parse", () => {
  it.each(loginExamples.map((e) => [e.value, e] as const))(
    "%j",
    (_, example) => {
      const parsed = parseLoginId(example.value);
      if (example.normalized === null) {
        expect(parsed).toBeNull();
      } else {
        expect(parsed).toEqual({
          kind: example.kind,
          value: example.normalized,
        });
      }
    },
  );
});

describe("parseLoginId", () => {
  it("reads an email by its «@», trimmed and lower-cased", () => {
    expect(parseLoginId(" Info@Brand.UA ")).toEqual({
      kind: "email",
      value: "info@brand.ua",
    });
  });

  it("turns 0XX…, 380XX… and +380XX… into one E.164 number", () => {
    for (const typed of [
      "0671234567",
      "380671234567",
      "+380671234567",
      "(067) 123-45-67",
    ]) {
      expect(parseLoginId(typed)).toEqual({
        kind: "phone",
        value: "+380671234567",
      });
    }
  });

  it("accepts other countries only with «+» and 8–15 digits", () => {
    expect(parseLoginId("+1 (212) 555-0123")?.value).toBe("+12125550123");
    expect(parseLoginId("12125550123")).toBeNull();
    expect(parseLoginId("+1234567")).toBeNull();
  });

  it("refuses rubbish and every phone matches the database CHECK", () => {
    for (const typed of [
      "",
      "abc",
      "067.123.45.67",
      "067+1234567",
      "+380 67 123 45 6x",
    ]) {
      expect(parseLoginId(typed)).toBeNull();
    }
    for (const example of loginExamples) {
      const parsed = parseLoginId(example.value);
      if (parsed?.kind === "phone") expect(parsed.value).toMatch(E164);
    }
  });
});
