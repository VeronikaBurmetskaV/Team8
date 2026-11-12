import { describe, expect, it } from "vitest";
import { ApiError } from "../api/client";
import type { ErrorCode } from "../api/types";
import { errorCodeOf, errorMessage, toFormErrors } from "./errors";
import { errorText, messages } from "./messages.uk";

describe("errorCodeOf", () => {
  it("keeps the code of an ApiError", () => {
    expect(errorCodeOf(new ApiError(401, "INVALID_CREDENTIALS"))).toBe(
      "INVALID_CREDENTIALS",
    );
  });

  it("reports a network failure as SERVICE_UNAVAILABLE", () => {
    // What `fetch` throws when the network is down.
    expect(errorCodeOf(new TypeError("Failed to fetch"))).toBe(
      "SERVICE_UNAVAILABLE",
    );
  });

  it("reports a code outside the dictionary as SERVICE_UNAVAILABLE", () => {
    const error = new ApiError(418, "BRAND_NEW_CODE" as ErrorCode);
    expect(errorCodeOf(error)).toBe("SERVICE_UNAVAILABLE");
  });

  it.each([undefined, null, "NOT_FOUND", { code: "NOT_FOUND" }])(
    "reports the non-error %j as SERVICE_UNAVAILABLE",
    (thrown) => {
      expect(errorCodeOf(thrown)).toBe("SERVICE_UNAVAILABLE");
    },
  );
});

describe("errorMessage", () => {
  it("gives the text of the story for a known code", () => {
    expect(errorMessage(new ApiError(401, "INVALID_CREDENTIALS"))).toBe(
      "Невірний email або пароль",
    );
  });

  it("never asks to check the entered data when the network is down", () => {
    expect(errorMessage(new TypeError("Failed to fetch"))).toBe(
      messages.SERVICE_UNAVAILABLE,
    );
  });
});

describe("errorText", () => {
  it("gives the text of a known code", () => {
    expect(errorText("CARD_INVALID_URL")).toBe(messages.CARD_INVALID_URL);
  });

  it.each(["Failed to fetch", "", "toString"])(
    "falls back to SERVICE_UNAVAILABLE for %j",
    (code) => {
      expect(errorText(code)).toBe(messages.SERVICE_UNAVAILABLE);
    },
  );
});

describe("toFormErrors", () => {
  const registerFields = { email: "email", password: "password" } as const;

  it("puts the error under the email field (US-21 S2)", () => {
    const error = new ApiError(409, "EMAIL_TAKEN_OR_INVALID", {
      email: "EMAIL_TAKEN_OR_INVALID",
    });
    expect(toFormErrors(error, registerFields)).toEqual({
      fields: { email: "EMAIL_TAKEN_OR_INVALID" },
      form: null,
    });
  });

  it("shows every failing field, not only the top-level code", () => {
    const error = new ApiError(400, "EMAIL_TAKEN_OR_INVALID", {
      email: "EMAIL_TAKEN_OR_INVALID",
      password: "PASSWORD_TOO_SHORT",
    });
    expect(toFormErrors(error, registerFields)).toEqual({
      fields: {
        email: "EMAIL_TAKEN_OR_INVALID",
        password: "PASSWORD_TOO_SHORT",
      },
      form: null,
    });
  });

  it("shows an error without fields once for the whole form", () => {
    const error = new ApiError(429, "TOO_MANY_REQUESTS");
    expect(toFormErrors(error, registerFields)).toEqual({
      fields: {},
      form: "TOO_MANY_REQUESTS",
    });
  });

  it("shows the top-level code when the form has no input for the field", () => {
    const error = new ApiError(400, "VALIDATION_FAILED", {
      logoUrl: "PROFILE_INVALID",
    });
    expect(toFormErrors(error, { name: "name" } as const)).toEqual({
      fields: {},
      form: "VALIDATION_FAILED",
    });
  });

  it("ignores request fields named like Object.prototype members", () => {
    // Built from JSON like a real response body: `toString` becomes an own property.
    const fields = JSON.parse('{"toString":"VALIDATION_FAILED"}') as Record<
      string,
      ErrorCode
    >;
    const error = new ApiError(400, "VALIDATION_FAILED", fields);
    expect(toFormErrors(error, registerFields)).toEqual({
      fields: {},
      form: "VALIDATION_FAILED",
    });
  });

  it("replaces an unknown field code by SERVICE_UNAVAILABLE", () => {
    const error = new ApiError(400, "VALIDATION_FAILED", {
      email: "BRAND_NEW_CODE" as ErrorCode,
    });
    expect(toFormErrors(error, registerFields)).toEqual({
      fields: { email: "SERVICE_UNAVAILABLE" },
      form: null,
    });
  });

  it("reports a network failure for the whole form", () => {
    expect(
      toFormErrors(new TypeError("Failed to fetch"), registerFields),
    ).toEqual({ fields: {}, form: "SERVICE_UNAVAILABLE" });
  });
});
