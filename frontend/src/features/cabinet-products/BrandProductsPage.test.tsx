import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type { BrandCard, BrandProfileResponse } from "../../api/types";
import { brandProfileQueryKey } from "../../shared/brandProfile";
import { messages } from "../../shared/messages.uk";
import {
  BrandProductsPage,
  ProductsListView,
  type PublishOutcome,
} from "./BrandProductsPage";
import { brandProductsKey } from "./queries";

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
    publishedAt: null,
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
        consented
        publishing={false}
        onPublish={noop}
        outcome={null}
        {...props}
      />
    </MemoryRouter>,
  );
}

const enabled = (text: string) =>
  new RegExp(`<button(?![^>]*disabled)[^>]*>${text}</button>`);
const disabled = (text: string) =>
  new RegExp(`<button[^>]*disabled=""[^>]*>${text}</button>`);

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

  it("is disabled while publishing", () => {
    const html = view({ publishing: true, selected: new Set(["a"]) });
    expect(html).toMatch(disabled("Публікуємо…"));
  });
});

describe("/brand/products: publishing without consent", () => {
  it("disables both buttons and explains it with a link to the consent", () => {
    const html = view({ consented: false, selected: new Set(["a"]) });
    expect(html).toMatch(disabled("Опублікувати вибрані \\(1\\)"));
    expect(html).toMatch(disabled("Опублікувати всі чернетки \\(3\\)"));
    expect(html).toContain("Публікація недоступна");
    expect(html).toMatch(
      /<a[^>]*href="\/brand\/profile#consent"[^>]*>Підтвердити згоду<\/a>/,
    );
    // the buttons point to the explanation
    const hintId = html.match(
      /<p id="([^"]+)"[^>]*>Публікація недоступна/,
    )?.[1];
    expect(hintId).toBeTruthy();
    expect(html).toContain(`aria-describedby="${hintId}"`);
  });

  it("shows the server's CONSENT_REQUIRED with the same link", () => {
    const html = view({ outcome: { kind: "error", code: "CONSENT_REQUIRED" } });
    expect(html).toContain(messages.CONSENT_REQUIRED);
  });
});

describe("/brand/products page", () => {
  function page(profileState: BrandProfileResponse["state"], url: string) {
    const client = new QueryClient();
    client.setQueryData(brandProductsKey, cards);
    client.setQueryData(brandProfileQueryKey, {
      state: profileState,
    } as BrandProfileResponse);
    return renderToString(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[url]}>
          <BrandProductsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it("opens on «Чернетки з сайту» from ?filter=imported", () => {
    const html = page("CONSENTED", "/brand/products?filter=imported");
    expect(html).toMatch(/<option value="imported-drafts" selected="">/);
    expect(html).not.toContain("Сукня d");
  });

  it("blocks publishing for a brand without consent", () => {
    const html = page("ACTIVE", "/brand/products");
    expect(html).toContain("Публікація недоступна");
  });
});
