/**
 * ⚠️ TEMPORARY DEMO DATA — delete together with `withDemoFallback` once the dev seed
 * (≥ 4 brands, ~30 cards) and the extra card fields exist on the backend.
 *
 * Used ONLY in development (`import.meta.env.DEV`) and only when GET /api/feed returns
 * no cards or fails (backend not started). A production build never shows these cards:
 * an empty feed there is the «Ви переглянули всі доступні речі» state (US-08.1 CL).
 * Brands, products and links are made up. There are no photos: the feed shows a grey stub
 * «Картинка N» instead (see `demoPictureNumber`), so nothing is loaded from the network.
 */
import type { FeedCard } from "../../api/types";

/** Demo cards have no photo; the stub is drawn by ProductCard (`photoStub`). */
const NO_PHOTO = "";

export const DEMO_FEED: readonly FeedCard[] = [
  {
    id: "demo-0001",
    name: "Лляна сукня-сорочка з поясом",
    brandName: "Demo Linen Studio",
    priceUah: 2400,
    photoUrl: NO_PHOTO,
    productUrl: "https://example.com/demo/linen-dress",
    sizes: [
      { label: "XS", available: true },
      { label: "S", available: true },
      { label: "M", available: false },
      { label: "L", available: true },
    ],
    colors: [
      { name: "Пісочний", hex: "#B5A892" },
      { name: "Графіт", hex: "#3A3A38" },
    ],
    material: "100% льон",
    description: "Вільний крій, довжина міді, знімний пояс.",
  },
  {
    id: "demo-0002",
    name: "Вовняний светр оверсайз",
    brandName: "Demo Knit Lab",
    priceUah: 3150,
    photoUrl: NO_PHOTO,
    productUrl: "https://example.com/demo/sweater?ref=feed",
    sizes: [
      { label: "S", available: false },
      { label: "M", available: true },
      { label: "L", available: true },
    ],
    colors: [{ name: "Молочний", hex: "#EFE8DA" }],
    material: "70% вовна мериноса, 30% поліамід",
  },
  {
    id: "demo-0003",
    name: "Джинси прямого крою з високою посадкою та дуже довгою назвою моделі для перевірки обрізання",
    brandName: "Demo Denim Brand With A Very Long Name",
    priceUah: 1890,
    photoUrl: NO_PHOTO,
    productUrl: "https://example.com/demo/jeans#fit",
    sizes: [
      { label: "26", available: true },
      { label: "28", available: true },
      { label: "30", available: false },
    ],
  },
  {
    id: "demo-0004",
    name: "Шкіряна сумка-шопер",
    brandName: "Demo Leather",
    priceUah: 5200,
    photoUrl: NO_PHOTO,
    productUrl: "https://example.com/demo/bag",
    colors: [
      { name: "Коричневий", hex: "#6F5B42" },
      { name: "Чорний", hex: "#15160A" },
    ],
    description:
      "Без розмірів і матеріалу: перевіряє, що порожні блоки не показуються.",
  },
  {
    id: "demo-0005",
    name: "Бавовняна футболка",
    brandName: "Demo Linen Studio",
    priceUah: 750,
    photoUrl: NO_PHOTO,
    productUrl: "https://example.com/demo/tee",
  },
];

/**
 * Number of a demo card for its «Картинка N» stub: 1 for the first demo card, and so on.
 * Null for any other card (real photos from the API are shown as before).
 */
export function demoPictureNumber(id: string): number | null {
  const index = DEMO_FEED.findIndex((card) => card.id === id);
  return index === -1 ? null : index + 1;
}

/**
 * The cards to show: the API's, or the demo ones in development when the API gives none.
 * `isDev` is a parameter so the rule can be unit-tested.
 */
export function withDemoFallback(
  apiItems: readonly FeedCard[] | undefined,
  apiFailed: boolean,
  isDev: boolean,
): { items: readonly FeedCard[]; isDemo: boolean } {
  const empty = apiItems === undefined || apiItems.length === 0;
  if (isDev && empty && (apiFailed || apiItems !== undefined)) {
    return { items: DEMO_FEED, isDemo: true };
  }
  return { items: apiItems ?? [], isDemo: false };
}
