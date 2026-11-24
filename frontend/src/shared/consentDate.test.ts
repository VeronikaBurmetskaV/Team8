import { describe, expect, it } from "vitest";
import { formatConsentDate } from "./consentDate";

describe("formatConsentDate", () => {
  it("shows the day in Kyiv as DD.MM.YYYY", () => {
    expect(formatConsentDate("2026-11-23T10:00:00Z")).toBe("23.11.2026");
    // 23:30 UTC is already the next day in Kyiv.
    expect(formatConsentDate("2026-11-23T23:30:00Z")).toBe("24.11.2026");
  });
});
