import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type {
  BrandCard,
  BrandProfileResponse,
  ProfileState,
} from "../../api/types";
import { brandProfileQueryKey } from "../../shared/brandProfile";
import { messages } from "../../shared/messages.uk";
import {
  BrandProductsPage,
  ProductsListView,
  type PublishOutcome,
} from "./BrandProductsPage";
import { brandProductsKey } from "./queries";

function profile(state: ProfileState): BrandProfileResponse {
  const consented = state === "CONSENTED";
  return {
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

function view(
  props: Partial<Parameters<typeof ProductsListView>[0]> = {},
): string {
  return renderToString(
    <MemoryRouter>
      <ProductsListView
        cards={cards}
        filter="all"
        onFilter={noop}
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
  it("marks imported cards «з сайту» and hand edits «змінено вручну»", () => {
    const html = view();
    expect(html.match(/>з сайту</g)).toHaveLength(3);
    expect(html.match(/>змінено вручну</g)).toHaveLength(1);
  });

  it("has a checkbox for every draft only, each with a clear label", () => {
    const html = view();
    expect(html).toContain('aria-label="Вибрати «Сукня a»"');
    expect(html).toContain('aria-label="Вибрати «Сукня d»"');
    expect(html).not.toContain('aria-label="Вибрати «Сукня c»"');
    expect(html).toContain('aria-label="Вибрати всі чернетки на сторінці"');
  });

  it("«Чернетки з сайту» shows only imported drafts", () => {
    const html = view({ filter: "imported-drafts" });
    expect(html).toContain("Сукня a");
    expect(html).toContain("Сукня b");
    expect(html).not.toContain("Сукня c");
    expect(html).not.toContain("Сукня d");
    expect(html).toMatch(enabled("Опублікувати всі чернетки \\(2\\)"));
  });

  it("drafts have «Редагувати», published cards don't", () => {
    const html = view();
    expect(html).toMatch(
      /<a[^>]*href="\/brand\/products\/a"[^>]*>Редагувати<\/a>/,
    );
    expect(html).toContain('aria-label="Редагувати «Сукня a»"');
    expect(html).not.toContain('href="/brand/products/c"');
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
  it("opens on «Чернетки з сайту» from ?filter=imported", () => {
    const html = page("CONSENTED", cards, "/brand/products?filter=imported");
    expect(html).toMatch(/<option value="imported-drafts" selected="">/);
    expect(html).not.toContain("Сукня d");
  });

  it("blocks publishing for a brand without consent", () => {
    const html = page("ACTIVE");
    expect(html).toContain(messages.CONSENT_REQUIRED);
    expect(html).toMatch(disabled("Опублікувати всі чернетки \\(3\\)"));
    for (const button of publishButtons(html)) {
      expect(button).toContain("disabled");
    }
  });
});
