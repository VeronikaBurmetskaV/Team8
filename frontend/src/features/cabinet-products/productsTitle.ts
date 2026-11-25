import { brandProductsTexts as t } from "../../shared/messages.uk";

/** The heading of /brand/products: «Товари бренду» and the brand name, when there is one. */
export function productsTitle(brandName: string | null | undefined): {
  title: string;
  brand: string | null;
} {
  const brand = brandName?.trim() ? brandName.trim() : null;
  return { title: t.title, brand };
}

/** The browser tab: «Товари BEVZA — FULLA», or «Товари бренду — FULLA» without a name. */
export function productsDocumentTitle(
  brandName: string | null | undefined,
): string {
  const { brand } = productsTitle(brandName);
  return brand === null ? t.documentTitle : t.documentTitleOf(brand);
}
