import { describe, expect, it } from "vitest";
import type { BrandProfileResponse, ImportStatus } from "../../api/types";
import { pollInterval, POLL_MS } from "./api";
import {
  formatDateTime,
  importStep,
  isFeedUrlOnSite,
  verificationFileText,
  verificationMetaTag,
  verificationRequired,
  waitUntil,
  websiteDomain,
} from "./siteImport";

const profile = {
  websiteUrl: "https://www.goldi.ua/uk",
  siteDomain: null,
} as BrandProfileResponse;

const idleStatus: ImportStatus = {
  status: "IDLE",
  method: null,
  startedAt: null,
  finishedAt: null,
  lastSuccessAt: null,
  lastSyncedAt: null,
  nextAllowedAt: null,
  found: 0,
  created: 0,
  updated: 0,
  skipped: 0,
  hidden: 0,
  errorCode: null,
  verificationRequired: true,
  demoMode: false,
};

describe("importStep", () => {
  it("asks for a website, then the verification, then offers the import", () => {
    expect(importStep({ ...profile, websiteUrl: null }, true)).toBe(
      "no-website",
    );
    expect(importStep(profile, true)).toBe("verify");
    expect(importStep({ ...profile, siteDomain: "goldi.ua" }, true)).toBe(
      "ready",
    );
  });

  it("in demo mode skips the verification: a website is enough", () => {
    expect(importStep(profile, false)).toBe("ready");
    expect(importStep({ ...profile, websiteUrl: null }, false)).toBe(
      "no-website",
    );
  });

  it("waits for the status before choosing", () => {
    expect(importStep(profile, null)).toBe("loading");
  });
});

describe("verificationRequired", () => {
  it("comes only from the status, and is required when unknown", () => {
    expect(verificationRequired(idleStatus, false)).toBe(true);
    expect(
      verificationRequired(
        { ...idleStatus, verificationRequired: false, demoMode: true },
        false,
      ),
    ).toBe(false);
    expect(verificationRequired(undefined, true)).toBeNull();
    // a failed load or an older backend without the field: the safe side
    expect(verificationRequired(undefined, false)).toBe(true);
    const old = { ...idleStatus } as Partial<ImportStatus>;
    delete old.verificationRequired;
    expect(verificationRequired(old as ImportStatus, false)).toBe(true);
  });
});

describe("websiteDomain", () => {
  it("is the host without www., like the server's SiteDomain", () => {
    expect(websiteDomain("https://www.goldi.ua/uk?x=1")).toBe("goldi.ua");
    expect(websiteDomain("https://shop.goldi.ua")).toBe("shop.goldi.ua");
    expect(websiteDomain("not a url")).toBeNull();
    expect(websiteDomain(null)).toBeNull();
  });
});

describe("verification snippets", () => {
  it("are the exact tag and file the server checks", () => {
    expect(verificationMetaTag("abc123")).toBe(
      '<meta name="fulla-verification" content="abc123">',
    );
    expect(verificationFileText("abc123")).toBe("abc123\n");
  });
});

describe("isFeedUrlOnSite", () => {
  it("accepts empty and https links on the domain or a subdomain only", () => {
    expect(isFeedUrlOnSite("", "goldi.ua")).toBe(true);
    expect(isFeedUrlOnSite("https://goldi.ua/feed.xml", "goldi.ua")).toBe(true);
    expect(isFeedUrlOnSite("https://export.goldi.ua/g.xml", "goldi.ua")).toBe(
      true,
    );
    expect(isFeedUrlOnSite("http://goldi.ua/feed.xml", "goldi.ua")).toBe(false);
    expect(isFeedUrlOnSite("https://notgoldi.ua/feed.xml", "goldi.ua")).toBe(
      false,
    );
    expect(isFeedUrlOnSite("https://prom.ua/feed.xml", "goldi.ua")).toBe(false);
  });
});

describe("polling", () => {
  it("polls every 3 s only while the import runs", () => {
    expect(POLL_MS).toBe(3000);
    expect(pollInterval({ ...idleStatus, status: "RUNNING" })).toBe(3000);
    expect(pollInterval({ ...idleStatus, status: "DONE" })).toBe(false);
    expect(pollInterval(undefined)).toBe(false);
  });
});

describe("waitUntil", () => {
  const next = "2026-11-25T16:30:00Z";
  const before = Date.parse("2026-11-25T16:25:00Z");
  const after = Date.parse("2026-11-25T16:31:00Z");

  it("is the next allowed time while it is ahead and nothing runs", () => {
    const done = {
      ...idleStatus,
      status: "DONE",
      nextAllowedAt: next,
    } as const;
    expect(waitUntil(done, before)).toBe(next);
    expect(waitUntil(done, after)).toBeNull();
    expect(waitUntil({ ...done, status: "RUNNING" }, before)).toBeNull();
  });
});

describe("formatDateTime", () => {
  it("shows Kyiv time", () => {
    expect(formatDateTime("2026-11-25T16:20:00Z")).toBe("25.11.2026, 18:20");
  });
});
