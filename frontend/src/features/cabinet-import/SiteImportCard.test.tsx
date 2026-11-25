import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type {
  BrandProfileResponse,
  ErrorCode,
  ImportStatus,
} from "../../api/types";
import { messages } from "../../shared/messages.uk";
import { SiteImportView, type SiteImportViewProps } from "./SiteImportCard";

const TOKEN = "0123456789abcdef0123456789abcdef";

const unverified: BrandProfileResponse = {
  name: "Goldi",
  websiteUrl: "https://goldi.ua",
  logoImageId: null,
  logoUrl: null,
  logoDisplayUrl: null,
  consentGiven: true,
  consentGivenAt: "2026-11-20T10:00:00Z",
  consentText: "Згода",
  state: "CONSENTED",
  feedUrl: null,
  siteDomain: null,
  siteVerifiedAt: null,
  verificationToken: TOKEN,
};

const verified: BrandProfileResponse = {
  ...unverified,
  siteDomain: "goldi.ua",
  siteVerifiedAt: "2026-11-24T10:00:00Z",
};

const idle: ImportStatus = {
  status: "IDLE",
  method: null,
  startedAt: null,
  finishedAt: null,
  lastSuccessAt: null,
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

const noop = () => undefined;
const action = (error: ErrorCode | null = null, pending = false) => ({
  pending,
  error,
});

function render(overrides: Partial<SiteImportViewProps> = {}): string {
  const props: SiteImportViewProps = {
    profile: verified,
    status: idle,
    required: true,
    now: Date.parse("2026-11-25T16:00:00Z"),
    verify: { ...action(), onVerify: noop },
    start: { ...action(), onStart: noop },
    feed: { ...action(), saved: false, onSave: noop },
    ...overrides,
  };
  return renderToString(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SiteImportView {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The text of an element with role="status" (React escapes quotes in the HTML). */
function statusRegion(html: string): string {
  const match = html.match(/<div[^>]*role="status"[^>]*>([\s\S]*?)<\/div>/);
  return match?.[1] ?? "";
}

const button = (text: string) =>
  new RegExp(
    `<button[^>]*>${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</button>`,
  );
const disabledButton = (text: string) =>
  new RegExp(
    `<button[^>]*disabled=""[^>]*>${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</button>`,
  );

describe("«Імпорт з сайту»: no website", () => {
  it("asks for the website in the profile", () => {
    const html = render({ profile: { ...unverified, websiteUrl: null } });
    expect(html).toMatch(
      /<a[^>]*href="\/brand\/profile"[^>]*>Додайте сайт бренду в профілі<\/a>/,
    );
    expect(html).not.toContain("Перевірити");
  });
});

describe("«Імпорт з сайту»: site not verified", () => {
  it("shows step 1 with the three ways and «Перевірити»", () => {
    const html = render({ profile: unverified });
    expect(html).toContain("Крок 1. Підтвердіть, що сайт ваш");
    expect(html).toContain("Мета-тег на головній сторінці");
    expect(html).toContain(
      `&lt;meta name=&quot;fulla-verification&quot; content=&quot;${TOKEN}&quot;&gt;`,
    );
    expect(html).toMatch(button("Скопіювати мета-тег"));
    expect(html).toMatch(button("Завантажити файл fulla-verification.txt"));
    expect(html).toContain("https://goldi.ua/fulla-verification.txt");
    expect(html).toContain("Автоматично через пошту");
    expect(html).toContain("info@goldi.ua");
    expect(html).toMatch(button("Перевірити"));
    // no import before the verification
    expect(html).not.toContain("Імпортувати товари");
  });

  it("disables «Перевірити» while the site is checked", () => {
    const html = render({
      profile: unverified,
      verify: { ...action(null, true), onVerify: noop },
    });
    expect(html).toMatch(disabledButton("Перевіряємо сайт…"));
  });

  it("shows a clear error when the check fails", () => {
    for (const code of [
      "SITE_VERIFICATION_FAILED",
      "SITE_UNREACHABLE",
      "TOO_MANY_REQUESTS",
    ] as const) {
      const html = render({
        profile: unverified,
        verify: { ...action(code), onVerify: noop },
      });
      expect(html).toMatch(
        new RegExp(`<p[^>]*role="alert"[^>]*>${messages[code]}</p>`),
      );
    }
  });
});

describe("«Імпорт з сайту»: site verified", () => {
  it("offers the import from the domain and the optional feed field", () => {
    const html = render();
    expect(html).toContain("Сайт goldi.ua підтверджено 24.11.2026");
    expect(html).toMatch(button("Імпортувати товари з goldi.ua"));
    expect(html).toContain("Посилання на товарний фід (необов&#x27;язково)");
    expect(html).toContain("Horoshop");
    expect(html).toContain("Prom");
    expect(html).toContain("Shopify");
    expect(html).toContain("автоматично раз на добу");
    expect(statusRegion(html)).toBe("");
  });

  it("shows the saved feed URL and a server error on it", () => {
    const html = render({
      profile: { ...verified, feedUrl: "https://goldi.ua/feed.xml" },
      feed: { ...action("PROFILE_INVALID"), saved: false, onSave: noop },
    });
    expect(html).toContain('value="https://goldi.ua/feed.xml"');
    expect(html).toContain("Вкажіть посилання https:// на домені goldi.ua");
  });

  it("shows the progress while the import runs, without blocking the page", () => {
    const html = render({ status: { ...idle, status: "RUNNING" } });
    expect(html).toMatch(/role="status"[^>]*aria-live="polite"/);
    expect(statusRegion(html)).toContain("Імпорт триває");
    expect(html).toMatch(disabledButton("Імпортувати товари з goldi.ua"));
    // the rest of the card stays usable
    expect(html).not.toMatch(disabledButton("Зберегти посилання на фід"));
  });

  it("shows the summary and «Переглянути чернетки» after the import", () => {
    const html = render({
      status: {
        ...idle,
        status: "DONE",
        method: "SHOPIFY",
        found: 32,
        created: 28,
        updated: 4,
        skipped: 3,
        hidden: 2,
        startedAt: "2026-11-25T15:50:00Z",
        finishedAt: "2026-11-25T15:55:00Z",
        lastSuccessAt: "2026-11-25T15:55:00Z",
        nextAllowedAt: "2026-11-25T16:00:00Z",
      },
    });
    const region = statusRegion(html);
    expect(region).toContain(
      "Знайдено 32, додано 28 як чернетки, оновлено 4, пропущено 3",
    );
    expect(region).toContain("Знято з публікації 2");
    expect(region).toMatch(
      /<a[^>]*href="\/brand\/products\?filter=imported"[^>]*>Переглянути чернетки<\/a>/,
    );
    expect(html).toContain("Останній імпорт: 25.11.2026, 17:55");
    expect(html).toMatch(button("Імпортувати товари з goldi.ua"));
  });

  it("shows why the import failed", () => {
    const html = render({
      status: { ...idle, status: "FAILED", errorCode: "NO_PRODUCTS_FOUND" },
    });
    expect(statusRegion(html)).toContain("Імпорт не вдався");
    expect(statusRegion(html)).toContain(
      messages.NO_PRODUCTS_FOUND.slice(0, 30),
    );
  });

  it("explains the 10-minute limit with the time of the next import", () => {
    const html = render({
      status: {
        ...idle,
        status: "DONE",
        nextAllowedAt: "2026-11-25T16:10:00Z",
      },
      start: { ...action("IMPORT_TOO_FREQUENT"), onStart: noop },
    });
    expect(html).toContain(messages.IMPORT_TOO_FREQUENT);
    expect(html).toContain("Наступний імпорт можна запустити о 18:10");
  });

  it("disables the import button while it starts", () => {
    const html = render({ start: { ...action(null, true), onStart: noop } });
    expect(html).toMatch(disabledButton("Запускаємо імпорт…"));
  });
});

describe("«Імпорт з сайту»: demo mode (verificationRequired = false)", () => {
  const demo = {
    required: false,
    status: { ...idle, verificationRequired: false, demoMode: true },
  };

  it("shows no verification step, only the feed field and the import button", () => {
    const html = render({ ...demo, profile: unverified });
    expect(html).not.toContain("Підтвердіть, що сайт ваш");
    expect(html).not.toContain("Мета-тег");
    expect(html).not.toContain("fulla-verification");
    expect(html).not.toContain("Автоматично через пошту");
    expect(html).not.toMatch(button("Перевірити"));
    expect(html).toContain("Посилання на товарний фід (необов&#x27;язково)");
    expect(html).toMatch(button("Імпортувати товари з goldi.ua"));
  });

  it("has the grey demo note above the import", () => {
    const html = render({ ...demo, profile: unverified });
    const note = html.indexOf(
      "Демо-режим: товари імпортуються лише локально для розробки і не публікуються для покупців",
    );
    expect(note).toBeGreaterThan(-1);
    expect(note).toBeLessThan(html.indexOf("Посилання на товарний фід"));
    expect(note).toBeLessThan(html.indexOf("Імпортувати товари з goldi.ua"));
  });

  it("uses the website's domain, not a verified one", () => {
    const html = render({
      ...demo,
      profile: {
        ...unverified,
        websiteUrl: "https://www.shop-goldi.com.ua/uk",
      },
    });
    expect(html).toMatch(button("Імпортувати товари з shop-goldi.com.ua"));
    expect(html).not.toContain("підтверджено");
  });

  it("still asks for a website when there is none", () => {
    const html = render({
      ...demo,
      profile: { ...unverified, websiteUrl: null },
    });
    expect(html).toContain("Додайте сайт бренду в профілі");
    expect(html).not.toContain("Імпортувати товари");
  });

  it("outside demo mode there is no demo note", () => {
    expect(render({ profile: unverified })).not.toContain("Демо-режим");
    expect(render()).not.toContain("Демо-режим");
  });
});

describe("«Імпорт з сайту»: before the status is loaded", () => {
  it("shows neither the verification nor the import", () => {
    const html = render({ profile: unverified, required: null, status: null });
    expect(html).toContain("Завантаження…");
    expect(html).not.toContain("Крок 1");
    expect(html).not.toContain("Імпортувати товари");
  });
});
