import { describe, expect, it } from "vitest";
import { ApiError } from "../../api/client";
import type { BrandProfileResponse } from "../../api/types";
import { toFormErrors } from "../../shared/errors";
import { messages, websiteUrlInvalidMessage } from "../../shared/messages.uk";
import {
  brandProfileFormSchema,
  CONSENT_TEXT,
  profileFields,
  profileSaveErrors,
  toBrandProfileFormValues,
  toBrandProfileRequest,
} from "./profileForm";

const activeProfile: BrandProfileResponse = {
  contactName: "Олена",
  name: "Лляна",
  websiteUrl: "https://lileya.com.ua",
  logoImageId: null,
  logoUrl: null,
  consentGiven: false,
  logoDisplayUrl: null,
  consentGivenAt: null,
  consentText: null,
  state: "ACTIVE",
  feedUrl: null,
  siteDomain: null,
  siteVerifiedAt: null,
  verificationToken: null,
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
      websiteUrl: "https://lileya.com.ua",
      consentGiven: false,
    });
    // no website saved → an empty field
    expect(
      toBrandProfileFormValues({ ...activeProfile, websiteUrl: null })
        .websiteUrl,
    ).toBe("");
    expect(toBrandProfileFormValues(activeProfile).consentGiven).toBe(false);
  });

  it("checks the box only when the server confirms the consent", () => {
    expect(toBrandProfileFormValues(consentedProfile)).toEqual({
      name: "Лляна",
      websiteUrl: "https://lileya.com.ua",
      consentGiven: true,
    });
  });
});

describe("brandProfileFormSchema", () => {
  it("«Сайт бренду» is optional here but must be a valid site when filled", () => {
    const base = {
      name: "Лляна",
      consentGiven: false,
    };
    expect(
      brandProfileFormSchema.safeParse({ ...base, websiteUrl: "" }).success,
    ).toBe(true);
    expect(
      brandProfileFormSchema.safeParse({
        ...base,
        websiteUrl: "http://lileya.ua",
      }).success,
    ).toBe(false);
    expect(
      brandProfileFormSchema.safeParse({
        ...base,
        websiteUrl: "https://lileya.ua",
      }).success,
    ).toBe(true);
  });

  it("accepts a save with or without the consent", () => {
    expect(
      brandProfileFormSchema.safeParse({
        name: "Лляна",
        websiteUrl: "https://lileya.com.ua",
        consentGiven: true,
      }).success,
    ).toBe(true);
    expect(
      brandProfileFormSchema.safeParse({
        name: "Лляна",
        websiteUrl: "https://lileya.com.ua",
        consentGiven: false,
      }).success,
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
  it("sends the website, and null for an empty field (PUT replaces it)", () => {
    expect(
      toBrandProfileRequest(
        {
          name: "Лляна",
          websiteUrl: "",
          consentGiven: false,
        },
        activeProfile,
      ).websiteUrl,
    ).toBeNull();
  });

  it("sends the consent when the box was ticked", () => {
    expect(
      toBrandProfileRequest(
        {
          name: "Лляна",
          websiteUrl: "https://lileya.com.ua",
          consentGiven: true,
        },
        activeProfile,
      ),
    ).toEqual({
      name: "Лляна",
      websiteUrl: "https://lileya.com.ua",
      feedUrl: null,
      logoImageId: null,
      logoUrl: null,
      consentGiven: true,
    });
  });

  it("sends the feed URL back as loaded, so a profile save keeps it (ADR-0017)", () => {
    expect(
      toBrandProfileRequest(
        {
          name: "Лляна",
          websiteUrl: "https://lileya.com.ua",
          consentGiven: false,
        },
        { ...activeProfile, feedUrl: "https://lileya.com.ua/feed.xml" },
      ).feedUrl,
    ).toBe("https://lileya.com.ua/feed.xml");
  });

  it("sends no consent when the box was not ticked", () => {
    expect(
      toBrandProfileRequest(
        {
          name: "Лляна",
          websiteUrl: "https://lileya.com.ua",
          consentGiven: false,
        },
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
      {
        name: "Лляна",
        websiteUrl: "https://lileya.com.ua",
        consentGiven: false,
      },
      withLogo,
    );
    expect(request.logoImageId).toBeNull();
    expect(request.logoUrl).toBe("https://cdn.brand-site.ua/logo.png");
  });

  it("never withdraws a consent the server has saved", () => {
    expect(
      toBrandProfileRequest(
        {
          name: "Лляна",
          websiteUrl: "https://lileya.com.ua",
          consentGiven: false,
        },
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

describe("a failed save shows its error under the right field", () => {
  it("400 PROFILE_INVALID on websiteUrl → the hint under «Сайт бренду», not «Сервіс недоступний»", () => {
    const texts = profileSaveErrors(
      new ApiError(400, "PROFILE_INVALID", { websiteUrl: "PROFILE_INVALID" }),
    );
    expect(texts).toEqual({ websiteUrl: websiteUrlInvalidMessage });
    expect(Object.values(texts)).not.toContain(messages.SERVICE_UNAVAILABLE);
  });

  it("a 500 without fields is the common text above the button", () => {
    expect(profileSaveErrors(new ApiError(500, "SERVICE_UNAVAILABLE"))).toEqual(
      { form: messages.SERVICE_UNAVAILABLE },
    );
  });
});

describe("«Сайт бренду» in the profile form", () => {
  const parse = (websiteUrl: string) =>
    brandProfileFormSchema.safeParse({
      name: "Goldi",
      websiteUrl,
      consentGiven: false,
    });

  it("accepts a link with srsltid and keeps only the clean address", () => {
    const result = parse("https://goldi.ua/?srsltid=AYCX9vJHexSw4L6lxjK6NU");
    expect(result.success).toBe(true);
    expect(result.data?.websiteUrl).toBe("https://goldi.ua/");
    expect(toBrandProfileRequest(result.data!, activeProfile).websiteUrl).toBe(
      "https://goldi.ua/",
    );
  });

  it("keeps useful parameters and rejects http://", () => {
    expect(parse("https://goldi.ua/?lang=uk").data?.websiteUrl).toBe(
      "https://goldi.ua/?lang=uk",
    );
    expect(parse("http://goldi.ua").success).toBe(false);
    expect(parse(`https://goldi.ua/${"a".repeat(2048)}`).success).toBe(false);
  });
});

describe("«Контактна особа» is not in the profile form any more (2026-12-02)", () => {
  it("is neither a form value nor sent: the server keeps the stored one", () => {
    expect(Object.keys(toBrandProfileFormValues(activeProfile))).not.toContain(
      "contactName",
    );
    const request = toBrandProfileRequest(
      brandProfileFormSchema.parse({
        name: "Лляна",
        websiteUrl: "",
        consentGiven: false,
      }),
      activeProfile,
    );
    expect(request).not.toHaveProperty("contactName");
    expect(profileFields).not.toHaveProperty("contactName");
  });
});
