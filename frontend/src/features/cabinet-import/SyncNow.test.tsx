import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import type { ImportStatus } from "../../api/types";
import { messages } from "../../shared/messages.uk";
import { reopenDelay } from "./api";
import { formatSyncedAt } from "./siteImport";
import { SyncNowView, type SyncNowViewProps } from "./SyncNow";

const NOW = Date.parse("2026-11-30T13:00:00Z"); // 15:00 in Kyiv

const done: ImportStatus = {
  status: "DONE",
  method: "SITEMAP",
  startedAt: "2026-11-30T12:30:00Z",
  finishedAt: "2026-11-30T12:32:00Z",
  lastSuccessAt: "2026-11-30T12:32:00Z",
  lastSyncedAt: "2026-11-30T12:32:00Z",
  nextAllowedAt: "2026-11-30T12:40:00Z",
  found: 3,
  created: 1,
  updated: 1,
  skipped: 0,
  hidden: 0,
  errorCode: null,
  verificationRequired: true,
  demoMode: false,
};

function render(props: Partial<SyncNowViewProps> = {}): string {
  return renderToString(
    <SyncNowView
      status={done}
      now={NOW}
      pending={false}
      error={null}
      onSync={() => undefined}
      {...props}
    />,
  );
}

describe("«Оновити з сайту»", () => {
  it("is an active button with «Оновлено: сьогодні о 14:32»", () => {
    const html = render();
    expect(html).toMatch(
      /<button(?![^>]*disabled)[^>]*>Оновити з сайту<\/button>/,
    );
    // right under the button, so it lines up with its left edge
    expect(html).toMatch(
      /<\/button><\/span><p id="sync-status" role="status"[^>]*>Оновлено: сьогодні о 14:32<\/p>/,
    );
  });

  it("shows the running sync and is disabled meanwhile", () => {
    const html = render({ status: { ...done, status: "RUNNING" } });
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*aria-busy="true"[^>]*>Оновити з сайту<\/button>/,
    );
    expect(html).toMatch(
      /role="status"[^>]*><span[^>]*aria-hidden="true"><\/span>Оновлюємо…<\/p>/,
    );
    // starting it (the request is on its way) looks the same
    expect(render({ pending: true })).toContain("Оновлюємо…");
  });

  it("during the limit: disabled, «Оновити знову можна о 14:40» only as a hint, no extra line", () => {
    const html = render({
      now: Date.parse("2026-11-30T12:35:00Z"),
      error: "IMPORT_TOO_FREQUENT",
    });
    expect(html).not.toContain("Наступний імпорт");
    const button =
      html.match(/<button[^>]*>Оновити з сайту<\/button>/)?.[0] ?? "";
    expect(button).toContain('disabled=""');
    expect(button).toContain('title="Оновити знову можна о 14:40"');
    expect(button).toContain('aria-describedby="sync-status sync-wait"');
    // the same words for screen readers, hidden; on the page only «Оновлено: …» stays
    expect(html).toMatch(
      /<span id="sync-wait" class="[^"]*_visuallyHidden[^"]*">Оновити знову можна о 14:40<\/span>/,
    );
    expect(html).toContain("Оновлено: сьогодні о 14:32");
    expect(html).toMatch(
      new RegExp(`role="alert"[^>]*>${messages.IMPORT_TOO_FREQUENT}<`),
    );
  });

  it("says so before the first sync, and when the last one failed", () => {
    expect(
      render({ status: { ...done, lastSyncedAt: null, lastSuccessAt: null } }),
    ).toContain("Ще не оновлювалося з сайту");
    expect(
      render({
        status: { ...done, status: "FAILED", errorCode: "SITE_UNREACHABLE" },
      }),
    ).toContain("Останнє оновлення не вдалося");
  });
});

describe("formatSyncedAt (Kyiv time)", () => {
  it("today, yesterday, or the date", () => {
    expect(formatSyncedAt("2026-11-30T12:32:00Z", NOW)).toBe(
      "сьогодні о 14:32",
    );
    expect(formatSyncedAt("2026-11-29T07:05:00Z", NOW)).toBe("вчора о 09:05");
    expect(formatSyncedAt("2026-11-20T12:32:00Z", NOW)).toBe(
      "20.11.2026 о 14:32",
    );
  });
});

describe("the button turns active by itself when the limit ends", () => {
  it("the timer fires just after nextAllowedAt; then the view is active again", () => {
    const at = Date.parse("2026-11-30T12:35:00Z");
    // 5 minutes ahead → the timer of useClockUntil waits 5 minutes (+ a quarter second)
    expect(reopenDelay("2026-11-30T12:40:00Z", at)).toBe(5 * 60 * 1000 + 250);
    // already passed → at once
    expect(reopenDelay("2026-11-30T12:30:00Z", at)).toBe(250);
    // the «now» the timer sets after that moment: the button is active, no hint
    const after = render({ now: Date.parse("2026-11-30T12:40:01Z") });
    expect(after).toMatch(
      /<button(?![^>]*disabled)[^>]*>Оновити з сайту<\/button>/,
    );
    expect(after).not.toContain("Оновити знову можна");
  });
});
