import { describe, expect, it } from "vitest";
import { brandNameInvalidMessage, messages } from "./messages.uk";
import {
  brandLoginSchema,
  brandNameSchema,
  brandRegisterSchema,
  cardFormSchema,
  IMAGE_MAX_BYTES,
  type CardFormValues,
} from "./validation";
import {
  cardNameExamples,
  cardPhotoUrlExamples,
  cardPriceExamples,
  cardProductUrlExamples,
} from "./validation.examples";

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
    "a\u0000b@brand.ua", // U+0000: the database cannot store it
    "in\u00A0fo@brand.ua", // a non-breaking space inside
    "info@bra\u0007nd.ua", // a control character
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
    ["\u00A0Ля\u00A0", "Ля"], // non-breaking spaces are trimmed too
    ["я".repeat(50), "я".repeat(50)],
    ["😀".repeat(50), "😀".repeat(50)], // 50 code points, not 100 UTF-16 units
  ])("accepts %j", (name, saved) => {
    expect(brandNameSchema.parse({ name }).name).toBe(saved);
  });

  it.each([
    "L",
    "x".repeat(51),
    "",
    "   ",
    " L ",
    "\u00A0\u00A0\u00A0", // only non-breaking spaces
    "ab\u0000cd", // U+0000
    "ab\u0007cd", // a control character
  ])("rejects %j with the name hint", (name) => {
    const result = brandNameSchema.safeParse({ name });
    expect(result.success).toBe(false);
    expect(fieldErrors(result)).toEqual({ name: [brandNameInvalidMessage] });
  });
});

const validForm: CardFormValues = {
  name: "Лляна сукня міді",
  priceUah: "2400",
  photo: { file: null, url: "https://cdn.brand-site.ua/dress.webp" },
  productUrl: "https://brand-site.ua/linen-dress",
};

/** Field → error code for every failing field; empty when the form is valid. */
function errorsOf(values: CardFormValues): Record<string, string> {
  const result = cardFormSchema.safeParse(values);
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join("."), issue.message]),
  );
}

function pngOfSize(bytes: number): File {
  return new File([new Uint8Array(bytes)], "photo.png", { type: "image/png" });
}

describe("cardFormSchema", () => {
  it("accepts the US-25.1 S1 form", () => {
    expect(errorsOf(validForm)).toEqual({});
  });

  it.each(cardNameExamples)("name %j", ({ value, valid }) => {
    expect(errorsOf({ ...validForm, name: value })).toEqual(
      valid ? {} : { name: "CARD_INVALID_NAME" },
    );
  });

  it.each(cardPriceExamples)("price %j", ({ value, valid }) => {
    expect(errorsOf({ ...validForm, priceUah: value })).toEqual(
      valid ? {} : { priceUah: "CARD_INVALID_PRICE_OR_PHOTO" },
    );
  });

  it.each(cardPhotoUrlExamples)("photo URL %j", ({ value, valid }) => {
    const photo = { file: null, url: value };
    expect(errorsOf({ ...validForm, photo })).toEqual(
      valid ? {} : { photo: "CARD_INVALID_PRICE_OR_PHOTO" },
    );
  });

  it.each(cardProductUrlExamples)("product URL %j", ({ value, valid }) => {
    expect(errorsOf({ ...validForm, productUrl: value })).toEqual(
      valid ? {} : { productUrl: "CARD_INVALID_URL" },
    );
  });

  it("accepts an uploaded file instead of a URL", () => {
    const photo = { file: pngOfSize(IMAGE_MAX_BYTES), url: "" };
    expect(errorsOf({ ...validForm, photo })).toEqual({});
  });

  it("rejects both a file and a URL", () => {
    const photo = { file: pngOfSize(10), url: validForm.photo.url };
    expect(errorsOf({ ...validForm, photo })).toEqual({
      photo: "CARD_INVALID_PRICE_OR_PHOTO",
    });
  });

  it("rejects a file over 5 MB or of another type", () => {
    const tooBig = { file: pngOfSize(IMAGE_MAX_BYTES + 1), url: "" };
    const svg = {
      file: new File(["<svg/>"], "a.svg", { type: "image/svg+xml" }),
      url: "",
    };
    for (const photo of [tooBig, svg]) {
      expect(errorsOf({ ...validForm, photo })).toEqual({
        photo: "CARD_INVALID_PRICE_OR_PHOTO",
      });
    }
  });

  it("reports every wrong field at once (US-25.1 S2 + US-26 S2)", () => {
    expect(
      errorsOf({ ...validForm, priceUah: "-500", productUrl: "сукня" }),
    ).toEqual({
      priceUah: "CARD_INVALID_PRICE_OR_PHOTO",
      productUrl: "CARD_INVALID_URL",
    });
  });

  it("trims the text fields", () => {
    const parsed = cardFormSchema.parse({
      ...validForm,
      name: "  Сукня ",
      priceUah: " 2400 ",
      productUrl: " http://x.ua ",
    });
    expect(parsed).toMatchObject({
      name: "Сукня",
      priceUah: "2400",
      productUrl: "http://x.ua",
    });
  });
});
