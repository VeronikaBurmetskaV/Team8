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

/** «1 новий товар», «3 нові товари», «5 нових товарів». */
export function newProductsCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  let words = "нових товарів";
  if (mod10 === 1 && mod100 !== 11) words = "новий товар";
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
    words = "нові товари";
  return `${count} ${words}`;
}

/** Common parts of the «Вподобане» page (shared/SavedProducts). */
export const savedProductsTexts = {
  count: (count: number) => productsCount(count),
  goToBrandSite: "Перейти на сайт бренду",
  goToBrandSiteLabel: (name: string) =>
    `Перейти на сайт бренду: ${name} (відкриється в новій вкладці)`,
  /** The «×» on a photo asks first; «Скасувати» is confirmTexts.cancel. */
  removeQuestion: "Впевнені, що хочете видалити товар?",
  removeConfirm: "Видалити",
  /** A compact card in the list opens the full card over the page. */
  openCardLabel: (name: string) => `Відкрити картку: ${name}`,
  closeCard: "Закрити картку",
} as const;

/** «Вподобане» (/favorites): likes from the swipe feed and hearts from the catalogue. */
export const favoritesTexts = {
  title: "Вподобане",
  empty: "Тут з'являться товари, які вам сподобались",
  toFeed: "Почати свайпати",
  toCatalog: "До каталогу",
  listLabel: "Вподобані товари",
  removeLabel: (name: string) => `Прибрати з Вподобаного: ${name}`,
} as const;

/** Texts of the buyer header (BuyerHeader.tsx) and the cart placeholder page. */
export const headerTexts = {
  logoLabel: "FULLA — на головну",
  tagline: "SWIPING",
  navLabel: "Навігація покупця",
  swipe: "Свайпати",
  favorites: "Вподобане",
  /** Accessible name of an icon with a counter of new items, e.g. «Вподобане: 3 нові товари». */
  withCount: (label: string, count: number) =>
    count === 0 ? label : `${label}: ${newProductsCount(count)}`,
  cart: "Кошик",
  profile: "Профіль",
  city: "Місто",
  cityKyiv: "Київ",
  language: "Мова",
  menuOpen: "Відкрити меню",
  menuClose: "Закрити меню",
  menuLabel: "Місто та мова",
  /** The thin bar after scrolling: its arrow opens the full header over the page. */
  compactExpand: "Розгорнути меню",
  compactCollapse: "Згорнути меню",
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
  toFavorites: "Переглянути Вподобане",
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

/** Catalogue home page (/): banner, filters placeholder and the grid of all products. */
export const catalogTexts = {
  bannerTitle: "Свайпай і знаходь своє",
  bannerSubtitle: "Одяг українських брендів в одній стрічці",
  bannerCta: "Почати свайпати",
  title: "Усі товари",
  count: (count: number) => productsCount(count),
  filters: "Фільтри",
  filtersClose: "Закрити фільтри",
  /** Panel order; «Ціна» and «Бренд» work, the others still expand to «Скоро». */
  filterGroups: ["Категорія одягу", "Розмір", "Ціна", "Бренд"],
  priceGroup: "Ціна",
  brandGroup: "Бренд",
  /** Next to «Бренд» in the panel: «Бренд · 2». */
  brandSelected: (count: number) => `· ${count}`,
  brandLoading: "Завантаження…",
  brandCount: (count: number) => `(${count})`,
  brandShowAll: (count: number) => `Показати всі (${count})`,
  brandCollapse: "Згорнути",
  brandSearchLabel: "Пошук бренду",
  brandSearchEmpty: "Нічого не знайдено",
  /** Announced (aria-live) while searching brands. */
  brandsFound: (count: number) => `Знайдено брендів: ${count}`,
  brandChipLabel: (name: string) => `Скинути фільтр: бренд ${name}`,
  /** Brand name on a catalogue tile: a link to /?brand=<key>. */
  brandLinkLabel: (name: string) => `Увесь одяг бренду ${name}`,
  /** «Сторінка бренду»: the home page with exactly one brand and no other filter. */
  brandPageKicker: "Бренд",
  backToAll: "Весь одяг",
  brandPageEmpty: "Товарів цього бренду поки немає",
  brandPageTitle: (name: string) => `${name} — FULLA`,
  resetAll: "Скинути все",
  /** Sticky button at the bottom of the drawer; closes it. */
  showResults: (count: number) => `Показати ${productsCount(count)}`,
  /** Announced (aria-live) after a filter changes. */
  found: (count: number) => `Знайдено ${productsCount(count)}`,
  soon: "Скоро",
  activeFilters: (count: number) => `активних фільтрів: ${count}`,
  /** Visible labels over the two fields of the «Ціна» group. */
  priceFromLabel: "Від",
  priceToLabel: "До",
  currency: "грн",
  /** The apply button under the slider; the prices come formatted («2 500»). */
  priceShowBetween: (min: string, max: string) =>
    `Показати від ${min} до ${max} грн`,
  priceShowFrom: (min: string) => `Показати від ${min} грн`,
  priceShowTo: (max: string) => `Показати до ${max} грн`,
  priceShowAll: "Показати всі ціни",
  priceMinThumb: "Мінімальна ціна",
  priceMaxThumb: "Максимальна ціна",
  /** The rightmost value: no upper limit. */
  priceOrMore: (amount: number) => `${amount}+ грн`,
  priceFrom: (price: string) => `від ${price}`,
  priceTo: (price: string) => `до ${price}`,
  /** «500 – 2500 грн»: the currency once, after the upper price. */
  priceBetween: (min: string, max: string) => `${min} – ${max}`,
  priceReset: "Скинути",
  priceResetLabel: "Скинути фільтр за ціною",
  priceChip: (range: string) => `Ціна: ${range}`,
  priceChipLabel: (range: string) => `Скинути фільтр: ціна ${range}`,
  emptyFiltered: "Немає одягу за цими фільтрами",
  loading: "Завантажуємо товари…",
  empty: "Товарів поки немає",
  error: "Не вдалося завантажити товари",
  retry: "Спробувати ще раз",
  showMore: "Показати ще",
  listLabel: "Усі товари",
  favoriteLabel: (name: string) => `Додати у Вподобане: ${name}`,
  photoPlaceholder: "Фото недоступне",
} as const;

/** True for a code of the dictionary; the server or a library may send anything. */
export function isErrorCode(code: unknown): code is ErrorCode {
  return typeof code === "string" && Object.hasOwn(messages, code);
}

/** Text for a code that arrives as a plain string (form libraries, unknown codes). */
export function errorText(code: string): string {
  return messages[isErrorCode(code) ? code : "SERVICE_UNAVAILABLE"];
}

/** Single login page /login with the «Вхід» / «Вхід для бренду» tabs. */
export const loginTexts = {
  title: "Вхід до FULLA",
  tabsLabel: "Тип входу",
  buyerTab: "Вхід",
  brandTab: "Вхід для бренду",
  buyerPlaceholder: "Тут скоро буде вхід для покупця",
  noAccount: "Немає акаунту?",
  createAccount: "Створити",
  createAccountSoon: "Реєстрація покупця скоро з'явиться",
  registerBrand: "Зареєструвати бренд",
} as const;

/** Brand cabinet home page (/brand) and the «Додати товар» entry it shares with /brand/products. */
export const cabinetHomeTexts = {
  title: "Кабінет бренду",
  home: "Головна",
  addProduct: "Додати товар",
  fillProfile: "Заповнити профіль бренду",
  noProducts: "У вас поки немає товарів",
  profileTitle: "Профіль бренду",
  brandName: "Назва бренду",
  noBrandName: "Ще не вказана",
  consent: "Згода на показ матеріалів",
  consentGiven: (date: string) => `Дана ${date}`,
  consentNotGiven: "Не дана",
  editProfile: "Редагувати профіль",
  productsTitle: "Товари",
  total: "Усього",
  published: "Опубліковано",
  drafts: "Чернетки",
  allProducts: "Усі товари",
  loading: "Завантаження…",
  retry: "Спробувати ще раз",
} as const;

/** Publishing a card from the product list /brand/products (US-31, US-22.2). */
export const publishTexts = {
  publish: "Опублікувати у стрічку", // US-31 CL, exact
  // PROVISIONAL: no story gives these texts.
  actions: "Дії",
  toProfile: "Надати згоду в профілі",
} as const;

/** Confirmation dialogs of the brand cabinet (shared/ConfirmDialog). */
export const confirmTexts = {
  cancel: "Скасувати",
  consentQuestion:
    "Після підтвердження згоду не можна буде відкликати самостійно. Підтвердити?",
  consentConfirm: "Підтвердити",
  consentSaving: "Зберігаємо згоду…",
  consentGivenOn: (date: string) => `Згоду надано ${date}`,
  consentNeedsName: "Спочатку збережіть назву бренду, потім надайте згоду",
  logoutQuestion: "Ви точно хочете вийти з профілю?",
  logoutConfirm: "Вийти",
} as const;
