import { describe, expect, it } from "vitest";
import { ApiError } from "../../api/client";
import type { CardFormValues } from "../../shared/validation";
import { toCardFormErrors, toCreateProductRequest } from "./cardForm";

describe("toCreateProductRequest", () => {
  const values: CardFormValues = {
    name: "Лляна сукня міді",
    priceUah: "2400",
    photo: { file: null, url: "https://cdn.brand-site.ua/dress.webp" },
    productUrl: "https://brand-site.ua/linen-dress",
  };

  it("sends the image URL when no file was uploaded", () => {
    expect(toCreateProductRequest(values, null)).toEqual({
      name: "Лляна сукня міді",
      priceUah: 2400,
      photoImageId: null,
      photoUrl: "https://cdn.brand-site.ua/dress.webp",
      productUrl: "https://brand-site.ua/linen-dress",
    });
  });

  it("sends only the id of the uploaded file", () => {
    const file = new File(["png"], "photo.png", { type: "image/png" });
    const withFile = { ...values, photo: { file, url: "" } };
    expect(toCreateProductRequest(withFile, "6f1c2b0e")).toEqual({
      name: "Лляна сукня міді",
      priceUah: 2400,
      photoImageId: "6f1c2b0e",
      photoUrl: null,
      productUrl: "https://brand-site.ua/linen-dress",
    });
  });

  it("sends the price as a number of UAH", () => {
    const request = toCreateProductRequest(
      { ...values, priceUah: "1000000" },
      null,
    );
    expect(request.priceUah).toBe(1_000_000);
  });
});

describe("toCardFormErrors", () => {
  it("spreads the API fields over the inputs of the form (US-25.1 S2, US-26 S2)", () => {
    const error = new ApiError(400, "CARD_INVALID_NAME", {
      name: "CARD_INVALID_NAME",
      priceUah: "CARD_INVALID_PRICE_OR_PHOTO",
      productUrl: "CARD_INVALID_URL",
    });
    expect(toCardFormErrors(error)).toEqual({
      fields: {
        name: "CARD_INVALID_NAME",
        priceUah: "CARD_INVALID_PRICE_OR_PHOTO",
        productUrl: "CARD_INVALID_URL",
      },
      form: null,
    });
  });

  it.each(["photoImageId", "photoUrl"])(
    "shows an error of %s at the photo",
    (requestName) => {
      const error = new ApiError(400, "CARD_INVALID_PRICE_OR_PHOTO", {
        [requestName]: "CARD_INVALID_PRICE_OR_PHOTO",
      });
      expect(toCardFormErrors(error)).toEqual({
        fields: { photo: "CARD_INVALID_PRICE_OR_PHOTO" },
        form: null,
      });
    },
  );

  it("shows a rejected upload at the photo", () => {
    expect(toCardFormErrors(new ApiError(400, "IMAGE_INVALID"))).toEqual({
      fields: { photo: "IMAGE_INVALID" },
      form: null,
    });
  });

  it("shows PROFILE_INCOMPLETE for the whole form", () => {
    expect(toCardFormErrors(new ApiError(409, "PROFILE_INCOMPLETE"))).toEqual({
      fields: {},
      form: "PROFILE_INCOMPLETE",
    });
  });

  it("reports a network failure for the whole form", () => {
    expect(toCardFormErrors(new TypeError("Failed to fetch"))).toEqual({
      fields: {},
      form: "SERVICE_UNAVAILABLE",
    });
  });
});
