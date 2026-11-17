import type { ErrorCode } from "../api/types";

/**
 * Shown under «Назва бренду» when only the name is wrong. The US-22.1 S2 hint for
 * PROFILE_INVALID also asks for a logo image, which is misleading under the name field.
 * PROVISIONAL: the name part of that hint plus the limits from US-22.1 CL.
 */
export const brandNameInvalidMessage = "Вкажіть назву бренду (2–50 символів)";

/**
 * The only place for Ukrainian error texts (api.md §3.2, ADR-0008).
 * A code added to ErrorCode without a text here fails the typecheck.
 */
export const messages: Record<ErrorCode, string> = {
  // Exact texts from the user stories — do not reword.
  EMAIL_TAKEN_OR_INVALID:
    "Цей email вже використовується або має некоректний формат", // US-21 S2
  INVALID_CREDENTIALS: "Невірний email або пароль", // US-21.1 S2
  PROFILE_INVALID:
    "Вкажіть назву бренду та завантажте зображення у форматі JPG, PNG або WEBP", // US-22.1 S2
  CARD_INVALID_PRICE_OR_PHOTO:
    "Вкажіть коректну ціну більше нуля та додайте фотографію товару", // US-25.1 S2
  CARD_INVALID_URL:
    "Введіть повне посилання на сторінку товару, що починається з https:// або http://", // US-26 S2
  CONSENT_REQUIRED:
    "Для показу товарів на платформі необхідно підтвердити згоду на демонстрацію матеріалів бренду", // US-22.2 S2
  PUBLISH_FIELDS_MISSING:
    "Заповніть усі обов'язкові поля картки (назва, фото, ціна, посилання) перед публікацією", // US-31 S2
  // Q-08 stopgap: the US-22.1 S2 text; the card form will need the US-25.1 S2 text instead.
  IMAGE_INVALID:
    "Вкажіть назву бренду та завантажте зображення у форматі JPG, PNG або WEBP",

  // PROVISIONAL: no story gives a text for these codes (Q-08, Q-13).
  // To be replaced by the designer/lead.
  PASSWORD_TOO_SHORT: "Пароль має містити від 8 до 72 символів",
  TOO_MANY_REQUESTS: "Забагато спроб. Спробуйте ще раз за хвилину",
  VALIDATION_FAILED: "Перевірте введені дані та спробуйте ще раз",
  UNAUTHENTICATED: "Увійдіть, щоб продовжити",
  FORBIDDEN: "Немає доступу. Оновіть сторінку та спробуйте ще раз",
  NOT_FOUND: "Не знайдено",
  SERVICE_UNAVAILABLE: "Сервіс тимчасово недоступний. Спробуйте пізніше",
  CONSENT_LOCKED: "Надану згоду не можна скасувати в кабінеті",
  PROFILE_INCOMPLETE: "Спочатку збережіть назву бренду в профілі",
  CARD_INVALID_NAME: "Вкажіть назву товару (до 100 символів)",
  CARD_NOT_EDITABLE:
    "Опубліковану картку не можна редагувати. Спочатку зніміть її з публікації",
  INVALID_STATE: "Стан картки вже змінився. Оновіть сторінку",
};

/** «1 товар», «3 товари», «5 товарів», «11 товарів», «21 товар». */
export function productsCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  let word = "товарів";
  if (mod10 === 1 && mod100 !== 11) word = "товар";
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
    word = "товари";
  return `${count} ${word}`;
}

/** Common parts of the «Вподобане зі свайпів» and «Вподобане» pages (shared/SavedProducts). */
export const savedProductsTexts = {
  count: (count: number) => productsCount(count),
  goToBrandSite: "Перейти на сайт бренду",
  goToBrandSiteLabel: (name: string) =>
    `Перейти на сайт бренду: ${name} (відкриється в новій вкладці)`,
  remove: "Прибрати",
} as const;

/** «Вподобане зі свайпів» (/swipe-favorites): every like from the feed. */
export const swipeFavoritesTexts = {
  title: "Вподобане зі свайпів",
  empty: "Ви ще нічого не вподобали у стрічці",
  toFeed: "Перейти до свайпання",
  listLabel: "Товари, вподобані у стрічці",
  add: "Додати у Вподобане",
  addLabel: (name: string) => `Додати у Вподобане: ${name}`,
  alreadyInFavorites: "Уже у Вподобаному",
  alreadyInFavoritesLabel: (name: string) => `${name}: уже у Вподобаному`,
  removeLabel: (name: string) => `Прибрати з вподобаного зі свайпів: ${name}`,
} as const;

/** «Вподобане» (/favorites): products the buyer added explicitly. */
export const favoritesTexts = {
  title: "Вподобане",
  empty: "Тут з'являться товари, які ви оберете",
  toSwipeFavorites: "Переглянути вподобане зі свайпів",
  listLabel: "Вподобані товари",
  removeLabel: (name: string) => `Прибрати з Вподобаного: ${name}`,
} as const;

/** Texts of the buyer header (BuyerHeader.tsx) and the cart placeholder page. */
export const headerTexts = {
  logoLabel: "FULLA — на головну",
  tagline: "SWIPING",
  navLabel: "Навігація покупця",
  swipe: "Свайпати",
  swipeFavorites: "Вподобане зі свайпів",
  favorites: "Вподобане",
  /** Accessible name of an icon with a counter, e.g. «Вподобане: 3 товари». */
  withCount: (label: string, count: number) =>
    count === 0 ? label : `${label}: ${productsCount(count)}`,
  cart: "Кошик",
  profile: "Профіль",
  city: "Місто",
  cityKyiv: "Київ",
  language: "Мова",
  menuOpen: "Відкрити меню",
  menuClose: "Закрити меню",
  menuLabel: "Місто та мова",
} as const;

/** Cart page (/cart). The cart lives only in this browser's localStorage. */
export const cartTexts = {
  title: "Кошик",
  empty: "Кошик порожній. Додайте речі зі стрічки кнопкою «Одразу в кошик».",
  toFeed: "До стрічки",
  goToBrandSite: "Перейти на сайт бренду",
  goToBrandSiteLabel: (name: string) =>
    `Перейти на сайт бренду: ${name} (відкриється в новій вкладці)`,
  remove: "Прибрати",
  removeLabel: (name: string) => `Прибрати з кошика: ${name}`,
  listLabel: "Товари в кошику",
} as const;

/**
 * The swipe card (shared/ProductCard): feed, «Вподобане», brand preview.
 * The stories call the buttons «Подобається» / «Пропустити» (US-08.1, US-09, US-10);
 * the current design uses «Сподобалось» / «Не сьогодні».
 */
export const productCardTexts = {
  photoPlaceholder: "Фото недоступне",
  sizes: "Розміри",
  sizeAvailable: (size: string) => `Розмір ${size}: є в наявності`,
  sizeUnavailable: (size: string) => `Розмір ${size}: немає в наявності`,
  colors: "Кольори",
  material: "Матеріал",
  description: "Опис",
  price: "Ціна",
  flip: "Перевернути",
  flipLabel: "Перевернути картку: деталі товару",
  back: "Назад до фото",
  backLabel: "Перевернути картку назад до фото",
  detailsTitle: "Деталі товару",
  noDetails: "Бренд ще не додав деталей до цього товару.",
} as const;

/** The swipe feed page (/feed). */
export const feedTexts = {
  title: "Стрічка",
  loading: "Завантажуємо речі…",
  retry: "Спробувати ще раз",
  like: "Сподобалось",
  likeLabel: "Сподобалось: зберегти й показати наступну річ",
  skip: "Не сьогодні",
  skipLabel: "Не сьогодні: пропустити й показати наступну річ",
  toCart: "Одразу в кошик",
  toCartLabel: "Одразу в кошик",
  addedToCart: "Додано в кошик",
  stampLike: "Подобається",
  stampSkip: "Не сьогодні",
  brandAll: (brand: string) => `${brand} — усі товари бренду на FULLA`,
  soon: "Скоро",
  allViewed: "Ви переглянули всі доступні речі",
  toFavorites: "Переглянути вподобане зі свайпів",
  hintOpen: "Як користуватись свайпанням",
  hintTitle: "Як користуватися стрічкою",
  hintClose: "Закрити підказку",
  hintLines: [
    "Свайп вправо — подобається",
    "Вліво — не сьогодні",
    "Кнопки збоку від картки (на телефоні — під нею) роблять те саме",
    "↻ — деталі товару й кнопка «Одразу в кошик»",
  ],
  hintKeyboard:
    "На клавіатурі: ← не сьогодні, → сподобалось, пробіл — перевернути.",
  cardRegion: "Картка товару",
  demoPicture: (n: number) => `Картинка ${n}`,
} as const;

/** True for a code of the dictionary; the server or a library may send anything. */
export function isErrorCode(code: unknown): code is ErrorCode {
  return typeof code === "string" && Object.hasOwn(messages, code);
}

/** Text for a code that arrives as a plain string (form libraries, unknown codes). */
export function errorText(code: string): string {
  return messages[isErrorCode(code) ? code : "SERVICE_UNAVAILABLE"];
}
