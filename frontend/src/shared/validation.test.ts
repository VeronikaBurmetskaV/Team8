import { describe, expect, it } from "vitest";
import {
  websiteUrlInvalidMessage,
  brandNameInvalidMessage,
  buyerAuthTexts,
  messages,
} from "./messages.uk";
import {
  brandLoginSchema,
  brandNameSchema,
  brandRegisterSchema,
  buyerLoginSchema,
  buyerRegisterSchema,
  cardFormSchema,
  editCardFormSchema,
  isWebsiteUrl,
  withHttps,
  cleanWebsiteUrl,
  normalizeWebsiteUrl,
  IMAGE_MAX_BYTES,
  isHttpsUrl,
  isHttpUrl,
  type CardFormValues,
} from "./validation";
import {
  cardNameExamples,
  cardPriceExamples,
  httpsUrlExamples,
  httpUrlExamples,
  websiteUrlExamples,
  websiteUrlNormalizedExamples,
  type ValidationExample,
} from "./validation.examples";

// The same examples as the backend tests BrandAuthTest and BrandProfileTest (R-T17).
const PASSWORD = "secret-123";
/** Valid name and website: the email and password tests change only their own field. */
const BRAND = {
  contactName: "Олена",
  name: "Lileya",
  websiteUrl: "https://lileya.com.ua",
};

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
        ...BRAND,
        email,
        password: PASSWORD,
      });
      expect(result.success).toBe(true);
    },
  );

  it("trims and lower-cases the email like the server", () => {
    const result = brandRegisterSchema.parse({
      ...BRAND,
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
    const result = brandRegisterSchema.safeParse({
      ...BRAND,
      email,
      password: PASSWORD,
    });
    expect(result.success).toBe(false);
    expect(fieldErrors(result)).toEqual({
      email: [messages.EMAIL_TAKEN_OR_INVALID],
    });
  });

  it("accepts an email of exactly 254 characters", () => {
    const email = `${"a".repeat(245)}@brand.ua`;
    expect(email).toHaveLength(254);
    const result = brandRegisterSchema.safeParse({
      ...BRAND,
      email,
      password: PASSWORD,
    });
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
      ...BRAND,
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
      ...BRAND,
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
      ...BRAND,
      email: "no-at-sign",
      password: "short",
    });
    expect(Object.keys(fieldErrors(result))).toEqual(["email", "password"]);
  });
});

describe("brandLoginSchema", () => {
  it("accepts a well-formed email and any non-empty password: the server decides", () => {
    const result = brandLoginSchema.parse({
      brandName: "  Lileya ",
      email: " Info@Brand.UA ",
      password: "1",
    });
    expect(result).toEqual({
      brandName: "Lileya",
      email: "Info@Brand.UA",
      password: "1",
    });
  });

  it.each([
    [{ email: "", password: PASSWORD }, { email: ["Введіть email"] }],
    [{ email: "   ", password: PASSWORD }, { email: ["Введіть email"] }],
    [
      { email: "info.brand.ua", password: PASSWORD },
      { email: ["Перевірте формат email"] },
    ],
    [
      { email: "info@brand.ua", password: "" },
      { password: ["Введіть пароль"] },
    ],
    [
      { email: "", password: "" },
      { email: ["Введіть email"], password: ["Введіть пароль"] },
    ],
  ])("%j → each error under its own field", (credentials, expected) => {
    const result = brandLoginSchema.safeParse({
      brandName: "Lileya",
      ...credentials,
    });
    expect(fieldErrors(result)).toEqual(expected);
  });

  it.each(["", "   ", "\u00A0"])(
    "an empty brand name %j gets «Введіть назву бренду» under its field",
    (brandName) => {
      const result = brandLoginSchema.safeParse({
        brandName,
        email: "info@brand.ua",
        password: PASSWORD,
      });
      expect(fieldErrors(result)).toEqual({
        brandName: ["Введіть назву бренду"],
      });
    },
  );

  it("1 and 50 characters pass, 51 don't", () => {
    const login = { email: "info@brand.ua", password: PASSWORD };
    expect(
      brandLoginSchema.safeParse({ ...login, brandName: "Л" }).success,
    ).toBe(true);
    expect(
      brandLoginSchema.safeParse({ ...login, brandName: "я".repeat(50) })
        .success,
    ).toBe(true);
    expect(
      fieldErrors(
        brandLoginSchema.safeParse({ ...login, brandName: "я".repeat(51) }),
      ),
    ).toEqual({ brandName: ["Назва бренду — до 50 символів"] });
  });
});

describe("buyerLoginSchema", () => {
  it("asks for both fields when they are empty", () => {
    const result = buyerLoginSchema.safeParse({
      name: " ",
      email: "  ",
      password: "",
    });
    expect(fieldErrors(result)).toEqual({
      name: ["Введіть імʼя"],
      email: [buyerAuthTexts.emailRequired],
      password: [buyerAuthTexts.passwordRequired],
    });
  });

  it.each(["buyer", "buyer@mail", "buyer@@mail.com", "bu yer@mail.com"])(
    "rejects the email %j",
    (email) => {
      const result = buyerLoginSchema.safeParse({
        name: "Софія",
        email,
        password: PASSWORD,
      });
      expect(fieldErrors(result)).toEqual({
        email: ["Перевірте формат email"],
      });
    },
  );

  it("accepts any non-empty password (the server decides)", () => {
    const result = buyerLoginSchema.safeParse({
      name: " Софія ",
      email: " buyer@mail.com ",
      password: "1",
    });
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe("Софія");
  });
});

describe("buyerRegisterSchema", () => {
  const valid = {
    name: "Софія",
    login: "Buyer@Mail.com",
    password: PASSWORD,
    confirmPassword: PASSWORD,
  };

  it("accepts an email or a phone in «Email або номер телефону»", () => {
    expect(buyerRegisterSchema.safeParse(valid).success).toBe(true);
    for (const login of [
      "0671234567",
      "+380 67 123 45 67",
      "+48 601 234 567",
    ]) {
      expect(buyerRegisterSchema.safeParse({ ...valid, login }).success).toBe(
        true,
      );
    }
  });

  it("rejects what is neither an email nor a phone", () => {
    for (const login of ["", "nope", "067123", "buyer@mail"]) {
      expect(
        fieldErrors(buyerRegisterSchema.safeParse({ ...valid, login })),
      ).toEqual({
        login: [buyerAuthTexts.loginInvalid],
      });
    }
    expect(buyerAuthTexts.loginInvalid).toBe(
      "Введіть email або номер телефону у форматі +380…",
    );
  });

  it("the name is required: 1–50 characters after trimming, not only spaces", () => {
    expect(buyerRegisterSchema.parse({ ...valid, name: "  Софія " }).name).toBe(
      "Софія",
    );
    for (const name of ["", "   "]) {
      expect(
        fieldErrors(buyerRegisterSchema.safeParse({ ...valid, name })),
      ).toEqual({
        name: [buyerAuthTexts.nameRequired],
      });
    }
    expect(buyerAuthTexts.nameRequired).toBe("Введіть імʼя");
    expect(
      buyerRegisterSchema.safeParse({ ...valid, name: "я".repeat(50) }).success,
    ).toBe(true);
    expect(
      fieldErrors(
        buyerRegisterSchema.safeParse({ ...valid, name: "я".repeat(51) }),
      ),
    ).toEqual({ name: [buyerAuthTexts.nameInvalid] });
  });

  it("«Підтвердити пароль»: rejects passwords that do not match", () => {
    expect(buyerAuthTexts.confirmPassword).toBe("Підтвердити пароль");
    const result = buyerRegisterSchema.safeParse({
      ...valid,
      confirmPassword: `${PASSWORD}!`,
    });
    expect(fieldErrors(result)).toEqual({
      confirmPassword: [buyerAuthTexts.passwordsMismatch],
    });
  });

  it("shows the mismatch together with other errors", () => {
    const result = buyerRegisterSchema.safeParse({
      ...valid,
      login: "nope",
      confirmPassword: "other",
    });
    expect(fieldErrors(result)).toEqual({
      login: [buyerAuthTexts.loginInvalid],
      confirmPassword: [buyerAuthTexts.passwordsMismatch],
    });
  });

  it("uses the backend password length (8 characters)", () => {
    const result = buyerRegisterSchema.safeParse({
      ...valid,
      password: "1234567",
      confirmPassword: "1234567",
    });
    expect(fieldErrors(result)).toEqual({
      password: [messages.PASSWORD_TOO_SHORT],
    });
  });

  it("asks to confirm the password when that field is empty", () => {
    expect(buyerAuthTexts.confirmRequired).toBe("Підтвердіть пароль");
    const result = buyerRegisterSchema.safeParse({
      ...valid,
      confirmPassword: "",
    });
    expect(fieldErrors(result)).toEqual({
      confirmPassword: [buyerAuthTexts.confirmRequired],
    });
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

// validation.examples.json is also read by the JUnit tests of @HttpUrl and @HttpsUrl,
// so both sides accept exactly the same URLs (final-review №6).
describe("URL validators: the same examples as the backend", () => {
  it.each(httpUrlExamples)("isHttpUrl %j", ({ value, valid }) => {
    expect(isHttpUrl(value)).toBe(valid);
  });

  it.each(httpsUrlExamples)("isHttpsUrl %j", ({ value, valid }) => {
    expect(isHttpsUrl(value)).toBe(valid);
  });
});

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

  // The form trims text fields first (see "trims the text fields"), so examples with
  // surrounding spaces are checked only on the validators below.
  const unpadded = (examples: ValidationExample[]) =>
    examples.filter(({ value }) => value === value.trim());

  it.each(unpadded(httpsUrlExamples))("photo URL %j", ({ value, valid }) => {
    const photo = { file: null, url: value };
    expect(errorsOf({ ...validForm, photo })).toEqual(
      valid ? {} : { photo: "CARD_INVALID_PRICE_OR_PHOTO" },
    );
  });

  it.each(unpadded(httpUrlExamples))("product URL %j", ({ value, valid }) => {
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

describe("brandRegisterSchema: brand name and website (US-21)", () => {
  const valid = { ...BRAND, email: "info@lileya.com.ua", password: PASSWORD };

  it("accepts a full form and trims name and website", () => {
    const result = brandRegisterSchema.parse({
      ...valid,
      name: "  Lileya ",
      websiteUrl: " https://lileya.com.ua ",
    });
    expect(result.name).toBe("Lileya");
    expect(result.websiteUrl).toBe("https://lileya.com.ua");
  });

  it.each(["", "L", "a".repeat(51), "Lil\u0000eya"])(
    "rejects the name %j with the profile rule",
    (name) => {
      const result = brandRegisterSchema.safeParse({ ...valid, name });
      expect(fieldErrors(result)).toEqual({ name: [brandNameInvalidMessage] });
    },
  );

  it.each([
    "",
    "http://lileya.com.ua",
    "lileya.com.ua",
    "https://",
    "https://lileya",
  ])("rejects the website %j", (websiteUrl) => {
    const result = brandRegisterSchema.safeParse({ ...valid, websiteUrl });
    expect(fieldErrors(result)).toEqual({
      websiteUrl: [websiteUrlInvalidMessage],
    });
  });

  it("reports every wrong field at once", () => {
    const result = brandRegisterSchema.safeParse({
      contactName: "",
      name: "",
      websiteUrl: "",
      email: "",
      password: "",
    });
    expect(Object.keys(fieldErrors(result))).toEqual([
      "contactName",
      "name",
      "websiteUrl",
      "email",
      "password",
    ]);
  });
});

describe("isWebsiteUrl: the same examples as @WebsiteUrl", () => {
  it.each(websiteUrlExamples.map((e) => [e.value.slice(0, 60), e] as const))(
    "%j",
    (_, example) => {
      expect(isWebsiteUrl(example.value)).toBe(example.valid);
    },
  );
});

describe("withHttps: «brand.com.ua» gets https:// when the field loses focus", () => {
  it.each([
    ["brand.com.ua", "https://brand.com.ua"],
    ["  brand.com.ua/uk ", "https://brand.com.ua/uk"],
    ["//brand.com.ua", "https://brand.com.ua"],
    ["https://brand.com.ua", "https://brand.com.ua"],
    // Another scheme stays as typed: the error says what is wrong.
    ["http://brand.com.ua", "http://brand.com.ua"],
    ["", ""],
  ])("%j → %j", (typed, expected) => {
    expect(withHttps(typed)).toBe(expected);
  });
});

describe("normalizeWebsiteUrl: the same examples as WebsiteUrlValidator.normalize", () => {
  it.each(websiteUrlNormalizedExamples)("$value → $normalized", (example) => {
    expect(normalizeWebsiteUrl(example.value)).toBe(example.normalized);
  });

  it("the field shows the clean link after it loses focus", () => {
    expect(cleanWebsiteUrl(" goldi.ua/?srsltid=abc ")).toBe(
      "https://goldi.ua/",
    );
    expect(cleanWebsiteUrl("https://goldi.ua/?lang=uk&utm_source=x")).toBe(
      "https://goldi.ua/?lang=uk",
    );
  });
});

describe("editCardFormSchema", () => {
  const values = {
    name: "Сукня",
    priceUah: "2400",
    photo: { file: null, url: "" },
    productUrl: "https://goldi.ua/a",
  };

  it("keeps an uploaded photo when neither a file nor a URL is given", () => {
    expect(editCardFormSchema(true).safeParse(values).success).toBe(true);
    expect(editCardFormSchema(false).safeParse(values).success).toBe(false);
    expect(cardFormSchema.safeParse(values).success).toBe(false);
  });

  it("checks a new photo URL and the other fields as on create", () => {
    const schema = editCardFormSchema(true);
    expect(
      schema.safeParse({
        ...values,
        photo: { file: null, url: "http://x.ua/a.jpg" },
      }).success,
    ).toBe(false);
    expect(schema.safeParse({ ...values, priceUah: "0" }).success).toBe(false);
  });
});
