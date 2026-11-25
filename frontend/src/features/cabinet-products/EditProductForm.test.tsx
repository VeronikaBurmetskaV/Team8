import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type { BrandCard } from "../../api/types";
import { EditProductView } from "./EditProductForm";

const draft: BrandCard = {
  id: "a",
  name: "Сукня з льону",
  brandName: "Goldi",
  priceUah: 3100,
  photoUrl: "https://cdn.goldi.ua/a.jpg",
  productUrl: "https://goldi.ua/products/a",
  photoImageId: null,
  status: "DRAFT",
  publishedAt: null,
  createdAt: "2026-11-25T10:00:00Z",
};

function render(card: BrandCard | undefined): string {
  return renderToString(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <EditProductView card={card} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("/brand/products/:id", () => {
  // The starting values come from toCardFormValues (productList.test.ts): react-hook-form
  // fills the uncontrolled inputs only in the browser, so they are not in the server HTML.
  it("edits a hand-made draft with the same fields as the create form", () => {
    const html = render(draft);
    expect(html).toContain("Редагування товару");
    for (const id of [
      "card-name",
      "card-price",
      "card-photo-file",
      "card-photo-url",
      "card-product-url",
    ]) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain("Зберегти зміни");
    expect(html).not.toContain("змінено вручну");
  });

  it("marks the hand-edited fields of an imported card", () => {
    const html = render({
      ...draft,
      sourceUrl: "https://goldi.ua/products.json",
      editedFields: ["name", "priceUah"],
    });
    expect(html).toContain("імпортовано з вашого сайту");
    expect(html.match(/змінено вручну, не оновлюється з сайту/g)).toHaveLength(
      2,
    );
    expect(html).toMatch(/Назва товару <span[^>]*>змінено вручну/);
    expect(html).toMatch(/Ціна в грн <span[^>]*>змінено вручну/);
  });

  it("keeps an uploaded photo unless a new one is chosen", () => {
    const html = render({
      ...draft,
      photoImageId: "img",
      photoUrl: "/api/images/img",
    });
    expect(html).toContain("Поточне фото залишиться");
  });

  it("doesn't show the form for a published card", () => {
    const html = render({ ...draft, status: "PUBLISHED" });
    expect(html).toContain("Опубліковану картку не можна редагувати");
    expect(html).not.toContain("<form");
  });

  it("says when the card is not in the list", () => {
    expect(render(undefined)).toContain("Товар не знайдено");
  });
});
