import { describe, expect, it } from "vitest";
import {
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
