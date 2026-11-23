import { describe, expect, it } from "vitest";
import { ApiError } from "../../api/client";
import type { BrandProfileResponse } from "../../api/types";
import { toFormErrors } from "../../shared/errors";
import {
  brandProfileFormSchema,
  CONSENT_TEXT,
  profileFields,
  toBrandProfileFormValues,
  toBrandProfileRequest,
} from "./profileForm";

const activeProfile: BrandProfileResponse = {
  name: "Лляна",
  logoImageId: null,
  logoUrl: null,
  consentGiven: false,
  logoDisplayUrl: null,
  consentGivenAt: null,
  consentText: null,
  state: "ACTIVE",
};

const consentedProfile: BrandProfileResponse = {
  ...activeProfile,
  consentGiven: true,
  consentGivenAt: "2026-11-23T10:00:00Z",
  consentText: CONSENT_TEXT,
  state: "CONSENTED",
};

describe("CONSENT_TEXT", () => {
  it("is the exact checkbox text of US-22.2", () => {
    expect(CONSENT_TEXT).toBe(
      "Я надаю згоду платформі FULLA на демонстрацію логотипа, фотографій та інформації про товари мого бренду",
    );
  });
});

describe("toBrandProfileFormValues", () => {
  it("leaves the checkbox unchecked while the server has no consent", () => {
    const incomplete = {
      ...activeProfile,
      name: null,
      state: "INCOMPLETE" as const,
    };
    expect(toBrandProfileFormValues(incomplete)).toEqual({
      name: "",
      consentGiven: false,
    });
    expect(toBrandProfileFormValues(activeProfile).consentGiven).toBe(false);
  });

  it("checks the box only when the server confirms the consent", () => {
    expect(toBrandProfileFormValues(consentedProfile)).toEqual({
      name: "Лляна",
      consentGiven: true,
    });
  });
});

describe("brandProfileFormSchema", () => {
  it("accepts a save with or without the consent", () => {
    expect(
      brandProfileFormSchema.safeParse({ name: "Лляна", consentGiven: true })
        .success,
    ).toBe(true);
    expect(
      brandProfileFormSchema.safeParse({ name: "Лляна", consentGiven: false })
        .success,
    ).toBe(true);
  });

  it("still rejects an invalid name", () => {
    expect(
      brandProfileFormSchema.safeParse({ name: "L", consentGiven: true })
        .success,
    ).toBe(false);
  });

  it("needs an explicit boolean for the consent", () => {
    expect(brandProfileFormSchema.safeParse({ name: "Лляна" }).success).toBe(
      false,
    );
  });
});

describe("toBrandProfileRequest", () => {
  it("sends the consent when the box was ticked", () => {
    expect(
      toBrandProfileRequest(
        { name: "Лляна", consentGiven: true },
        activeProfile,
      ),
    ).toEqual({
      name: "Лляна",
      logoImageId: null,
      logoUrl: null,
      consentGiven: true,
    });
  });

  it("sends no consent when the box was not ticked", () => {
    expect(
      toBrandProfileRequest(
        { name: "Лляна", consentGiven: false },
        activeProfile,
      ).consentGiven,
    ).toBe(false);
  });

  it("keeps the logo as loaded", () => {
    const withLogo = {
      ...activeProfile,
      logoUrl: "https://cdn.brand-site.ua/logo.png",
    };
    const request = toBrandProfileRequest(
      { name: "Лляна", consentGiven: false },
      withLogo,
    );
    expect(request.logoImageId).toBeNull();
    expect(request.logoUrl).toBe("https://cdn.brand-site.ua/logo.png");
  });

  it("never withdraws a consent the server has saved", () => {
    expect(
      toBrandProfileRequest(
        { name: "Лляна", consentGiven: false },
        consentedProfile,
      ).consentGiven,
    ).toBe(true);
  });
});

describe("profile save errors", () => {
  it("shows CONSENT_LOCKED for the whole form", () => {
    const error = new ApiError(409, "CONSENT_LOCKED");
    expect(toFormErrors(error, profileFields)).toEqual({
      fields: {},
      form: "CONSENT_LOCKED",
    });
  });

  it("shows a name error under the name field", () => {
    const error = new ApiError(400, "PROFILE_INVALID", {
      name: "PROFILE_INVALID",
    });
    expect(toFormErrors(error, profileFields)).toEqual({
      fields: { name: "PROFILE_INVALID" },
      form: null,
    });
  });

  it("shows a consent field error under the checkbox", () => {
    const error = new ApiError(400, "VALIDATION_FAILED", {
      consentGiven: "VALIDATION_FAILED",
    });
    expect(toFormErrors(error, profileFields).fields).toEqual({
      consentGiven: "VALIDATION_FAILED",
    });
  });

  it("treats a network failure as SERVICE_UNAVAILABLE", () => {
    expect(toFormErrors(new TypeError("fetch failed"), profileFields)).toEqual({
      fields: {},
      form: "SERVICE_UNAVAILABLE",
    });
  });
});
