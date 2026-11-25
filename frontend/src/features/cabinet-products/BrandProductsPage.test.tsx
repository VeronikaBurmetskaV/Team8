import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type {
  BrandCard,
  BrandProfileResponse,
  ImportStatus,
  ProfileState,
} from "../../api/types";
import { brandProfileQueryKey } from "../../shared/brandProfile";
import { importStatusKey } from "../cabinet-import/api";
import { messages } from "../../shared/messages.uk";
import { productsDocumentTitle } from "./productsTitle";
import {
  BrandProductsPage,
  ProductsListView,
  ProductsTitle,
  type PublishOutcome,
} from "./BrandProductsPage";
import {
  brandProductsKey,
  publishOneOptions,
  refreshAfterPublishChange,
} from "./queries";
import {
  answerUnpublish,
  listOrder,
  selectableIds,
  toggleAll,
} from "./productList";

function profile(state: ProfileState): BrandProfileResponse {
  const consented = state === "CONSENTED";
  return {
    contactName: "Олена",
    name: state === "INCOMPLETE" ? null : "Goldi",
    websiteUrl: null,
    logoImageId: null,
    logoUrl: null,
    logoDisplayUrl: null,
    consentGiven: consented,
    consentGivenAt: consented ? "2026-11-23T10:00:00Z" : null,
    consentText: consented ? "Згода" : null,
    state,
    feedUrl: null,
    siteDomain: null,
    siteVerifiedAt: null,
    verificationToken: null,
  };
}

function card(
  id: string,
  status: BrandCard["status"],
  extra: Partial<BrandCard> = {},
): BrandCard {
  return {
    id,
    name: `Сукня ${id}`,
    brandName: "Goldi",
    priceUah: 2400,
    photoUrl: "https://cdn.goldi.ua/a.jpg",
    productUrl: "https://goldi.ua/a",
    photoImageId: null,
    status,
    publishedAt: status === "PUBLISHED" ? "2026-11-24T10:00:00Z" : null,
    createdAt: "2026-11-25T10:00:00Z",
    ...extra,
  };
}

const imported = {
  sourceUrl: "https://goldi.ua/products.json",
  editedFields: [],
};
const cards = [
  card("a", "DRAFT", imported),
  card("b", "DRAFT", { ...imported, editedFields: ["priceUah"] }),
  card("c", "PUBLISHED", imported),
  card("d", "DRAFT"),
];

const noop = () => undefined;

/** The <tr> of the card with this name, as an HTML string. */
function rowOf(html: string, name: string): string {
  const start = html.lastIndexOf("<tr", html.indexOf(`>${name}<`));
  return html.slice(start, html.indexOf("</tr>", start));
}

function view(
  props: Partial<Parameters<typeof ProductsListView>[0]> = {},
): string {
  return renderToString(
    <MemoryRouter>
      <ProductsListView
        cards={cards}
        selected={new Set()}
        onSelect={noop}
        profileState="CONSENTED"
        publishing={false}
        onPublish={noop}
        outcome={null}
        publishingIds={[]}
        onPublishOne={noop}
        rowErrors={{}}
        {...props}
      />
    </MemoryRouter>,
  );
}

/** Renders /brand/products with both queries already answered (no network in the test). */
function page(
  state: ProfileState,
  products: BrandCard[] = cards,
  url = "/brand/products",
): string {
  const client = new QueryClient();
  client.setQueryData(brandProfileQueryKey, profile(state));
  client.setQueryData(brandProductsKey, products);
  return renderToString(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <BrandProductsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const enabled = (text: string) =>
  new RegExp(`<button(?![^>]*disabled)[^>]*>${text}</button>`);
const disabled = (text: string) =>
  new RegExp(`<button[^>]*disabled=""[^>]*>${text}</button>`);

/** The <button> elements with the single-card publish text, as HTML strings. */
function publishButtons(html: string): string[] {
  return [
    ...html.matchAll(/<button[^>]*>Опублікувати у стрічку<\/button>/g),
  ].map((match) => match[0]);
}

describe("/brand/products: imported cards", () => {
  it("has no badges in the rows: no «з сайту», no «змінено вручну»", () => {
    const html = view();
    expect(html).not.toContain(">з сайту<");
    expect(html).not.toContain("змінено вручну");
    expect(html).not.toMatch(/class="[^"]*_badge/);
    // and no filter any more
    expect(html).not.toContain("<select");
    expect(html).not.toContain("Показати");
    expect(html).not.toContain("Чернетки з сайту");
  });

  it("shows the name, then the price and the status under it, with a large photo", () => {
    const html = view();
    expect(html).toMatch(
      /<p class="[^"]*_name[^"]*">Сукня a<\/p><p class="[^"]*_meta[^"]*"><span[^>]*>2400 грн<\/span><span[^>]*>Чернетка<\/span><\/p>/,
    );
    expect(html).toMatch(/<img class="[^"]*_thumbnail[^"]*"/);
    expect(html).toContain(">Опубліковано</span>");
  });

  it("selects with round native checkboxes: keyboard and screen readers work as usual", () => {
    const html = view({ selected: new Set(["a"]) });
    const selectors = [
      ...html.matchAll(/<input[^>]*class="[^"]*_selector[^"]*"[^>]*>/g),
    ].map((match) => match[0]);
    // «вибрати всі» + every card (drafts and the published one), each a real checkbox
    // (Space toggles it, Tab reaches it)
    expect(selectors).toHaveLength(5);
    for (const selector of selectors) {
      expect(selector).toContain('type="checkbox"');
      expect(selector).toMatch(/aria-label="Вибрати/);
      expect(selector).not.toContain("tabindex");
      expect(selector).not.toContain("role=");
    }
    expect(selectors.filter((tag) => tag.includes('checked=""'))).toHaveLength(
      1,
    );
    // the selected row is marked for the green frame
    expect(html).toMatch(/<tr class="[^"]*_selected[^"]*"/);
  });

  it("has a circle in every row, published ones too, each with a clear label", () => {
    const html = view();
    expect(html).toContain('aria-label="Вибрати «Сукня a»"');
    expect(html).toContain('aria-label="Вибрати «Сукня d»"');
    expect(html).toContain('aria-label="Вибрати «Сукня c»"');
    expect(html).toContain('aria-label="Вибрати всі товари на сторінці"');
  });

  it("always shows every card, with «4 товари» left of the publish buttons", () => {
    const html = view();
    for (const id of ["a", "b", "c", "d"])
      expect(html).toContain(`Сукня ${id}`);
    const toolbar = html.slice(0, html.indexOf("<table"));
    expect(toolbar).toMatch(/<p class="[^"]*_count[^"]*">4 товари<\/p>/);
    expect(toolbar.indexOf("4 товари")).toBeLessThan(
      toolbar.indexOf("Опублікувати вибрані"),
    );
  });

  it("every row: the main action on top, «Редагувати» under it", () => {
    const html = view();
    const actions = (id: string) =>
      rowOf(html, `Сукня ${id}`).match(
        /<div class="[^"]*_rowActions[^"]*">(.*?)<\/div>/s,
      )?.[1] ?? "";
    // a draft: «Опублікувати у стрічку», then «Редагувати»
    expect(actions("a")).toMatch(
      /^<button[^>]*>Опублікувати у стрічку<\/button><a class="[^"]*_edit[^"]*"[^>]*href="\/brand\/products\/a"[^>]*>Редагувати<\/a>$/,
    );
    // a published card: «Зняти з публікації», then «Редагувати» (it has one now too)
    expect(actions("c")).toMatch(
      /^<button[^>]*class="[^"]*_unpublish[^"]*"[^>]*>Зняти з публікації<\/button><a class="[^"]*_edit[^"]*"[^>]*href="\/brand\/products\/c"[^>]*>Редагувати<\/a>$/,
    );
  });
});

describe("/brand/products: «Немає на сайті» (ADR-0017)", () => {
  const gone = card("g", "DRAFT", {
    ...imported,
    name: "Зникла сукня",
    notOnSiteSince: "2026-11-30T10:00:00Z",
  });
  const withGone = [gone, ...cards];

  function goneRow(html: string): string {
    const start = html.lastIndexOf("<tr", html.indexOf("Зникла сукня"));
    return html.slice(start, html.indexOf("</tr>", start));
  }

  it("is the last row, muted, with its own status and the hint", () => {
    const html = view({ cards: withGone });
    expect(html.indexOf("Зникла сукня")).toBeGreaterThan(
      html.indexOf("Сукня d"),
    );
    const row = goneRow(html);
    expect(row).toMatch(/^<tr class="[^"]*_notOnSite/);
    expect(row).not.toContain("_selectable");
    expect(row).toContain(">Немає на сайті</span>");
    expect(row).toMatch(
      /<p id="not-on-site-g"[^>]*>Цього товару більше немає на сайті бренду<\/p>/,
    );
  });

  it("has no circle and no publish / unpublish button, only the hint, «Прибрати» and «Редагувати»", () => {
    const row = goneRow(view({ cards: withGone }));
    expect(row).not.toContain("<input");
    expect(publishButtons(row)).toHaveLength(0);
    expect(row).not.toContain("Зняти з публікації");
    expect(row).toContain("Цього товару більше немає на сайті бренду");
    expect(row).toMatch(/>Прибрати зі списку<\/button><a[^>]*>Редагувати<\/a>/);
  });

  it("is not counted by «вибрати всі» nor by «Опублікувати всі»", () => {
    const html = view({ cards: withGone });
    expect(html).toMatch(enabled("Опублікувати всі чернетки \\(3\\)"));
  });

  it("has «Прибрати зі списку», busy while it runs", () => {
    expect(goneRow(view({ cards: withGone }))).toMatch(
      /<button[^>]*aria-label="Прибрати «Зникла сукня» зі списку"[^>]*>Прибрати зі списку<\/button>/,
    );
    expect(goneRow(view({ cards: withGone, removingIds: ["g"] }))).toMatch(
      disabled("Прибираємо…"),
    );
  });

  it("«Опублікувати вибрані» reports the skipped ones", () => {
    const html = view({
      cards: withGone,
      outcome: {
        kind: "done",
        result: { publishedIds: ["a"], skippedIds: [] },
        notOnSite: 2,
      },
    });
    expect(html).toContain("Опубліковано товарів: 1");
    expect(html).toContain("2 товари пропущено: їх немає на сайті");
  });

  it("only skipped ones: no «Опубліковано товарів: 0»", () => {
    const html = view({
      cards: withGone,
      outcome: {
        kind: "done",
        result: { publishedIds: [], skippedIds: [] },
        notOnSite: 1,
      },
    });
    expect(html).not.toContain("Опубліковано товарів");
    expect(html).toContain("1 товар пропущено: його немає на сайті");
  });

  it("a selected card that went missing still counts in «Опублікувати вибрані»", () => {
    const html = view({ cards: withGone, selected: new Set(["a", "g"]) });
    expect(html).toMatch(enabled("Опублікувати вибрані \\(2\\)"));
  });
});

function importStatus(lastSyncedAt: string | null): ImportStatus {
  return {
    status: "DONE",
    method: "SITEMAP",
    startedAt: null,
    finishedAt: null,
    lastSuccessAt: lastSyncedAt,
    lastSyncedAt,
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
}

/** /brand/products of «BEVZA (demo)», a brand whose site is verified. */
function pageWithSite(
  status: ImportStatus,
  extra: Partial<BrandProfileResponse> = {},
): string {
  const client = new QueryClient();
  client.setQueryData(brandProfileQueryKey, {
    ...profile("CONSENTED"),
    name: "BEVZA (demo)",
    websiteUrl: "https://bevza.com",
    siteDomain: "bevza.com",
    siteVerifiedAt: "2026-11-24T10:00:00Z",
    ...extra,
  });
  client.setQueryData(brandProductsKey, cards);
  client.setQueryData(importStatusKey, status);
  return renderToString(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/brand/products"]}>
        <BrandProductsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("/brand/products: the top of the page", () => {
  it("names the brand in the title, in its own green span", () => {
    const html = pageWithSite(importStatus(null));
    expect(html).toMatch(
      /<h1 class="[^"]*_title[^"]*">Товари бренду <span class="[^"]*_brandName[^"]*">BEVZA \(demo\)<\/span><\/h1>/,
    );
  });

  it("is just «Товари бренду» while the profile loads, and without a name", () => {
    const client = new QueryClient();
    client.setQueryData(brandProductsKey, cards);
    const loading = renderToString(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <BrandProductsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(loading).toMatch(/<h1[^>]*>Товари бренду<\/h1>/);
    expect(page("INCOMPLETE")).toMatch(/<h1[^>]*>Товари бренду<\/h1>/);
    expect(renderToString(<ProductsTitle brandName="   " />)).toMatch(
      /<h1[^>]*>Товари бренду<\/h1>/,
    );
  });

  it("puts «Товари BEVZA — FULLA» in the browser tab", () => {
    expect(productsDocumentTitle("BEVZA (demo)")).toBe(
      "Товари BEVZA (demo) — FULLA",
    );
    expect(productsDocumentTitle(null)).toBe("Товари бренду — FULLA");
  });

  it("has «Оновити з сайту» and «Додати вручну» side by side, no old buttons", () => {
    const html = pageWithSite(importStatus("2026-11-30T16:52:00Z"));
    expect(html).toMatch(enabled("Оновити з сайту"));
    const group = html.match(
      /<div class="[^"]*_actionGroup[^"]*">.*?<a[^>]*>Додати вручну<\/a><\/div>/s,
    )?.[0];
    expect(group).toBeDefined();
    expect(group).toContain(">Оновити з сайту</button>");
    expect(group).toMatch(
      /<a class="[^"]*_outline[^"]*" href="\/brand\/products\/new"[^>]*>Додати вручну<\/a>/,
    );
    // «Оновити з сайту» comes first
    expect(group!.indexOf("Оновити з сайту")).toBeLessThan(
      group!.indexOf("Додати вручну"),
    );
    expect(html).not.toContain("Додати товар");
    expect(html).not.toContain("Оновити з сайту зараз");
  });

  it("shows the last sync under the button, small and grey", () => {
    const html = pageWithSite(importStatus("2026-11-30T16:52:00Z"));
    const sync =
      html.match(/<div class="[^"]*_sync[^"]*">.*?<\/p>/s)?.[0] ?? "";
    expect(sync).toMatch(
      /<button[^>]*>Оновити з сайту<\/button><\/span><p id="sync-status" role="status" class="[^"]*_note[^"]*">Оновлено: (сьогодні|вчора|\d\d\.\d\d\.\d{4}) о 18:52<\/p>/,
    );
  });

  it("shows «Оновлюємо…» with a spinner while it runs, the button off", () => {
    const html = pageWithSite({
      ...importStatus("2026-11-30T16:52:00Z"),
      status: "RUNNING",
    });
    expect(html).toMatch(disabled("Оновити з сайту"));
    expect(html).toMatch(
      /role="status"[^>]*><span class="[^"]*_spinner[^"]*" aria-hidden="true"><\/span>Оновлюємо…<\/p>/,
    );
  });

  it("without a website: the way to the profile instead of the button, «Додати вручну» stays", () => {
    const html = page("CONSENTED");
    expect(html).not.toMatch(/>Оновити з сайту</);
    expect(html).toMatch(
      /<a[^>]*href="\/brand\/profile"[^>]*>Додайте сайт бренду в профілі<\/a>/,
    );
    expect(html).toMatch(
      /<a[^>]*href="\/brand\/products\/new"[^>]*>Додати вручну<\/a>/,
    );
  });
});

describe("/brand/products: «Зняти з публікації» (US-31 CL)", () => {
  it("asks first with ConfirmDialog: «Зняти» and «Скасувати»", () => {
    const closed = view();
    expect(closed).not.toContain("Зняти товар з публікації?");
    const html = view({ confirming: { ids: ["c"], bulk: false } });
    expect(html).toMatch(/<dialog[^>]*role="alertdialog"/);
    expect(html).toContain(
      "Зняти товар з публікації? Покупці більше не побачать його в стрічці й каталозі.",
    );
    expect(html).toMatch(/<button[^>]*>Зняти<\/button>/);
    expect(html).toMatch(/<button[^>]*>Скасувати<\/button>/);
  });

  it("«Зняти» sends it, «Скасувати» sends nothing", () => {
    const one = vi.fn();
    const many = vi.fn();
    answerUnpublish({ ids: ["c"], bulk: false }, false, { one, many });
    answerUnpublish(null, true, { one, many });
    expect(one).not.toHaveBeenCalled();
    expect(many).not.toHaveBeenCalled();

    answerUnpublish({ ids: ["c"], bulk: false }, true, { one, many });
    expect(one).toHaveBeenCalledWith("c");
    answerUnpublish({ ids: ["c", "e"], bulk: true }, true, { one, many });
    expect(many).toHaveBeenCalledWith(["c", "e"]);
  });

  it("after it the card is «Чернетка» with «Опублікувати у стрічку»", () => {
    const html = view({
      cards: cards.map((each) =>
        each.id === "c"
          ? { ...each, status: "DRAFT" as const, publishedAt: null }
          : each,
      ),
    });
    const row = rowOf(html, "Сукня c");
    expect(row).toContain(">Чернетка</span>");
    expect(publishButtons(row)).toHaveLength(1);
    expect(row).not.toContain("Зняти з публікації");
  });

  it("is busy while its request runs", () => {
    const row = rowOf(view({ unpublishingIds: ["c"] }), "Сукня c");
    expect(row).toMatch(
      /<button[^>]*disabled=""[^>]*aria-busy="true"[^>]*>Зняти з публікації<\/button>/,
    );
  });

  it("makes buyers' lists reload: the feed, the catalogue and the brand tiles", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await refreshAfterPublishChange(client);
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual(
      [["brand", "products"], ["feed"], ["brands"]],
    );
  });

  it("shows how many were taken off after the bulk action", () => {
    const html = view({
      outcome: {
        kind: "unpublished",
        result: { unpublishedIds: ["c"], skippedIds: [] },
      },
    });
    expect(html).toContain("Знято з публікації товарів: 1");
  });
});

describe("/brand/products: the bulk bar", () => {
  const bar = (html: string) =>
    html.match(/<div class="[^"]*_publishBar[^"]*">(.*?)<\/div>/s)?.[1] ?? "";
  const labels = (html: string) =>
    [...bar(html).matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map(
      (match) => match[1],
    );

  it("«Опублікувати всі чернетки» on the left, «Опублікувати вибрані» on the right", () => {
    expect(labels(view())).toEqual([
      "Опублікувати всі чернетки (3)",
      "Опублікувати вибрані (0)",
    ]);
  });

  it("with published cards selected: «Зняти вибрані з публікації (N)»; «Опублікувати вибрані» counts drafts only", () => {
    const html = view({ selected: new Set(["a", "c"]) });
    expect(labels(html)).toEqual([
      "Опублікувати всі чернетки (3)",
      "Опублікувати вибрані (1)",
      "Зняти вибрані з публікації (1)",
    ]);
    expect(bar(html)).toMatch(
      /<button(?![^>]*disabled)[^>]*class="[^"]*_unpublish[^"]*"[^>]*>Зняти вибрані з публікації \(1\)<\/button>/,
    );
  });

  it("only published selected: «Опублікувати вибрані (0)» stays muted", () => {
    const html = view({ selected: new Set(["c"]) });
    expect(html).toMatch(disabled("Опублікувати вибрані \\(0\\)"));
    expect(html).toMatch(enabled("Зняти вибрані з публікації \\(1\\)"));
  });

  it("«вибрати всі» selects published cards too", () => {
    expect(
      [...toggleAll(new Set(), selectableIds(listOrder(cards)))].sort(),
    ).toEqual(["a", "b", "c", "d"]);
  });
});

describe("/brand/products: bulk publishing", () => {
  it("counts the selected drafts and all drafts", () => {
    const html = view({ selected: new Set(["a", "d", "c"]) });
    expect(html).toMatch(enabled("Опублікувати вибрані \\(2\\)"));
    expect(html).toMatch(enabled("Опублікувати всі чернетки \\(3\\)"));
  });

  it("«Опублікувати вибрані» is off while nothing is selected", () => {
    expect(view()).toMatch(disabled("Опублікувати вибрані \\(0\\)"));
  });

  it("shows how many were published and skipped (role=status)", () => {
    const outcome: PublishOutcome = {
      kind: "done",
      result: { publishedIds: ["a", "d"], skippedIds: ["c"] },
      notOnSite: 0,
    };
    const html = view({ outcome });
    expect(html).toMatch(/role="status"[^>]*aria-live="polite"/);
    expect(html).toContain("Опубліковано товарів: 2");
    expect(html).toContain("Не опубліковано: 1");
  });

  it("is disabled while publishing, the row buttons too", () => {
    const html = view({ publishing: true, selected: new Set(["a"]) });
    expect(html).toMatch(disabled("Публікуємо…"));
    const buttons = publishButtons(html);
    expect(buttons).toHaveLength(3);
    for (const button of buttons) expect(button).toContain("disabled");
  });
});

describe("/brand/products: publishing one card (US-31)", () => {
  it("offers an active publish button for a draft of a CONSENTED brand", () => {
    const html = page("CONSENTED", [card("1", "DRAFT")]);
    const buttons = publishButtons(html);
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).not.toContain("disabled");
    expect(html).not.toContain(messages.CONSENT_REQUIRED);
  });

  it("shows «Опубліковано» and no button for a PUBLISHED card (US-31 S1)", () => {
    const html = page("CONSENTED", [card("1", "PUBLISHED")]);
    expect(html).toContain("Опубліковано");
    expect(publishButtons(html)).toHaveLength(0);
  });

  it("marks only the card whose request is running as busy", () => {
    const buttons = publishButtons(view({ publishingIds: ["a"] }));
    expect(buttons[0]).toContain("disabled");
    expect(buttons[0]).toContain('aria-busy="true"');
    expect(buttons[1]).not.toContain("disabled");
  });

  it("shows a failed publish in the card's row", () => {
    const html = view({ rowErrors: { a: "PUBLISH_FIELDS_MISSING" } });
    // The text has an apostrophe (escaped as &#x27;) and parentheses: match its start.
    expect(html).toMatch(/role="alert"[^>]*>Заповніть усі обов/);
    expect(html.match(/role="alert"/g)).toHaveLength(1);
  });

  it("shows no text for INVALID_STATE: the refetched list shows the status", () => {
    const html = view({ rowErrors: { a: "INVALID_STATE" } });
    expect(html).not.toContain('role="alert"');
  });
});

describe("/brand/products: publishing without consent (US-31 S2, US-22.2 S2)", () => {
  it("disables every publish button and explains it once, with a link to the consent", () => {
    const html = view({ profileState: "ACTIVE", selected: new Set(["a"]) });
    expect(html).toMatch(disabled("Опублікувати вибрані \\(1\\)"));
    expect(html).toMatch(disabled("Опублікувати всі чернетки \\(3\\)"));
    for (const button of publishButtons(html)) {
      expect(button).toContain("disabled");
      expect(button).toContain('aria-describedby="publish-consent-hint"');
    }
    expect(html.split(messages.CONSENT_REQUIRED)).toHaveLength(2);
    expect(html).toMatch(
      /<p id="publish-consent-hint"[^>]*>Для показу товарів/,
    );
    expect(html).toMatch(
      /<a[^>]*href="\/brand\/profile#consent"[^>]*>Підтвердити згоду<\/a>/,
    );
    expect(html).toMatch(
      /<button[^>]*aria-describedby="publish-consent-hint"[^>]*>Опублікувати вибрані/,
    );
  });

  it("does not repeat CONSENT_REQUIRED in a row when the hint already says it", () => {
    const html = view({
      profileState: "ACTIVE",
      rowErrors: { a: "CONSENT_REQUIRED" },
    });
    expect(html.split(messages.CONSENT_REQUIRED)).toHaveLength(2);
    expect(html).not.toContain('role="alert"');
  });

  it("shows the server's CONSENT_REQUIRED with the same link", () => {
    const html = view({ outcome: { kind: "error", code: "CONSENT_REQUIRED" } });
    expect(html).toContain(messages.CONSENT_REQUIRED);
    expect(html).toMatch(
      /<a[^>]*href="\/brand\/profile#consent"[^>]*>Підтвердити згоду<\/a>/,
    );
  });

  it("shows no hint while the profile is loading, but keeps the buttons off", () => {
    const html = view({ profileState: null });
    expect(html).not.toContain(messages.CONSENT_REQUIRED);
    for (const button of publishButtons(html)) {
      expect(button).toContain("disabled");
    }
  });

  it("shows no consent hint when there are no drafts", () => {
    const html = page("ACTIVE", [card("1", "PUBLISHED")]);
    expect(html).not.toContain(messages.CONSENT_REQUIRED);
    expect(publishButtons(html)).toHaveLength(0);
  });
});

describe("/brand/products page", () => {
  it("blocks publishing for a brand without consent", () => {
    const html = page("ACTIVE");
    expect(html).toContain(messages.CONSENT_REQUIRED);
    expect(html).toMatch(disabled("Опублікувати всі чернетки \\(3\\)"));
    for (const button of publishButtons(html)) {
      expect(button).toContain("disabled");
    }
  });
});

describe("a publish refreshes the brand tiles and the catalogue (no reload)", () => {
  it("publishing one card invalidates the feed and /api/brands", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await publishOneOptions(client).onSuccess(card("a", "PUBLISHED"));
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual(
      [["brand", "products"], ["feed"], ["brands"]],
    );
  });
});
