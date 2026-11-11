import { describe, expect, it } from "vitest";
import { brandNameInvalidMessage, messages } from "./messages.uk";
import {
  brandLoginSchema,
  brandNameSchema,
  brandRegisterSchema,
} from "./validation";

// The same examples as the backend tests BrandAuthTest and BrandProfileTest (R-T17).
const PASSWORD = "secret-123";

/** Field name → messages of a failed parse. */
function fieldErrors(result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of result.error?.issues ?? []) {
    const field = String(issue.path[0]);
    errors[field] = [...(errors[field] ?? []), issue.message];
  }
  return errors;
}

describe("brandRegisterSchema: email", () => {
  it.each(["info@brand.ua", "name.surname@shop.brand.com.ua"])(
    "accepts %j",
    (email) => {
      const result = brandRegisterSchema.safeParse({
        email,
        password: PASSWORD,
      });
      expect(result.success).toBe(true);
    },
  );

  it("trims and lower-cases the email like the server", () => {
    const result = brandRegisterSchema.parse({
      email: "  Info@Brand.UA ",
      password: PASSWORD,
    });
    expect(result.email).toBe("info@brand.ua");
  });

  it.each([
    "info.brand.ua",
    "info@brand",
    "info@@brand.ua",
    "in fo@brand.ua",
    "@brand.ua",
    "",
    "no-at-sign",
    `${"a".repeat(246)}@brand.ua`, // 255 characters
  ])("rejects %j with the story text", (email) => {
    const result = brandRegisterSchema.safeParse({ email, password: PASSWORD });
    expect(result.success).toBe(false);
    expect(fieldErrors(result)).toEqual({
      email: [messages.EMAIL_TAKEN_OR_INVALID],
    });
  });

  it("accepts an email of exactly 254 characters", () => {
    const email = `${"a".repeat(245)}@brand.ua`;
    expect(email).toHaveLength(254);
    const result = brandRegisterSchema.safeParse({ email, password: PASSWORD });
    expect(result.success).toBe(true);
  });
});

describe("brandRegisterSchema: password", () => {
  it.each([
    "12345678", // exactly 8
    "x".repeat(72), // the BCrypt limit
    "        ", // spaces count: the password is not trimmed
  ])("accepts %j", (password) => {
    const result = brandRegisterSchema.safeParse({
      email: "info@brand.ua",
      password,
    });
    expect(result.success).toBe(true);
  });

  it.each([
    "1234567", // 7 characters
    "",
    "x".repeat(73), // longer than the BCrypt limit
    "я".repeat(37), // 37 characters, but 74 UTF-8 bytes
  ])("rejects %j", (password) => {
    const result = brandRegisterSchema.safeParse({
      email: "info@brand.ua",
      password,
    });
    expect(result.success).toBe(false);
    expect(fieldErrors(result)).toEqual({
      password: [messages.PASSWORD_TOO_SHORT],
    });
  });

  it("reports both fields when both are wrong", () => {
    const result = brandRegisterSchema.safeParse({
      email: "no-at-sign",
      password: "short",
    });
    expect(Object.keys(fieldErrors(result))).toEqual(["email", "password"]);
  });
});

describe("brandLoginSchema", () => {
  it("accepts anything that is not empty: the server decides", () => {
    const result = brandLoginSchema.parse({
      email: " not-an-email ",
      password: "1",
    });
    expect(result).toEqual({ email: "not-an-email", password: "1" });
  });

  it.each([
    { email: "", password: PASSWORD },
    { email: "   ", password: PASSWORD },
    { email: "info@brand.ua", password: "" },
  ])("rejects %j with the common message", (credentials) => {
    const result = brandLoginSchema.safeParse(credentials);
    expect(result.success).toBe(false);
    const texts = Object.values(fieldErrors(result)).flat();
    expect(texts).toEqual([messages.INVALID_CREDENTIALS]);
  });
});

describe("brandNameSchema", () => {
  it.each([
    ["Lileya", "Lileya"],
    ["  Ля  ", "Ля"], // trimmed, 2 characters
    ["я".repeat(50), "я".repeat(50)],
    ["😀".repeat(50), "😀".repeat(50)], // 50 code points, not 100 UTF-16 units
  ])("accepts %j", (name, saved) => {
    expect(brandNameSchema.parse({ name }).name).toBe(saved);
  });

  it.each(["L", "x".repeat(51), "", "   ", " L "])(
    "rejects %j with the name hint",
    (name) => {
      const result = brandNameSchema.safeParse({ name });
      expect(result.success).toBe(false);
      expect(fieldErrors(result)).toEqual({ name: [brandNameInvalidMessage] });
    },
  );
});
