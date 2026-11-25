/**
 * Acceptance tests of the card form (US-25.1, US-26): the values of the Gherkin scenarios go
 * through the same schema the form uses, and the brand sees the exact text of the story.
 * The full list of valid/invalid values is in shared/validation.test.ts.
 */
import { describe, expect, it } from "vitest";
import { ApiError } from "../../api/client";
import { errorText } from "../../shared/messages.uk";
import { cardFormSchema, type CardFormValues } from "../../shared/validation";
import { toCardFormErrors } from "./cardForm";

// Exact texts of the stories — copied from user stories/US-25.1.md and US-26.md S2.
const PRICE_OR_PHOTO_TEXT =
  "Вкажіть коректну ціну більше нуля та додайте фотографію товару";
const URL_TEXT =
  "Введіть повне посилання на сторінку товару, що починається з https:// або http://";

/** US-25.1 S1: «Лляна сукня міді», 2400, a photo and the link to the dress. */
const s1Form: CardFormValues = {
  name: "Лляна сукня міді",
  priceUah: "2400",
  photo: { file: null, url: "https://cdn.brand-site.ua/linen-dress.webp" },
  productUrl: "https://brand-site.ua/linen-dress",
};

/** The text shown under each failing field, as the form renders it. */
function shownErrors(values: CardFormValues): Record<string, string> {
  const result = cardFormSchema.safeParse(values);
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [
      String(issue.path[0]),
      errorText(issue.message),
    ]),
  );
}

describe("US-25.1 S1: the brand fills the form correctly", () => {
  it("the form of the scenario has no errors and can be saved", () => {
    expect(shownErrors(s1Form)).toEqual({});
  });
});

describe("US-25.1 S2: a wrong price or no photo", () => {
  it.each(["-500", "0", "текст"])(
    "price %j: the hint of the story is shown at the price",
    (priceUah) => {
      expect(shownErrors({ ...s1Form, priceUah })).toEqual({
        priceUah: PRICE_OR_PHOTO_TEXT,
      });
    },
  );

  it("no photo: the same hint is shown at the photo", () => {
    expect(shownErrors({ ...s1Form, photo: { file: null, url: "" } })).toEqual({
      photo: PRICE_OR_PHOTO_TEXT,
    });
  });

  it("when the server refuses the price, the hint is shown at the price field", () => {
    const error = new ApiError(400, "CARD_INVALID_PRICE_OR_PHOTO", {
      priceUah: "CARD_INVALID_PRICE_OR_PHOTO",
    });
    const { fields, form } = toCardFormErrors(error);
    expect(form).toBeNull();
    expect(errorText(fields.priceUah ?? "")).toBe(PRICE_OR_PHOTO_TEXT);
  });
});

describe("US-26 S2: the link is not a URL", () => {
  it.each(["сукня", "brand-site.ua/linen-dress"])(
    "%j: the URL hint of the story is shown at the link",
    (productUrl) => {
      expect(shownErrors({ ...s1Form, productUrl })).toEqual({
        productUrl: URL_TEXT,
      });
    },
  );
});
