import type { ErrorCode } from "../api/types";

/**
 * Shown under «Назва бренду» when only the name is wrong. The US-22.1 S2 hint for
 * PROFILE_INVALID also asks for a logo image, which is misleading under the name field.
 * PROVISIONAL: the name part of that hint plus the limits from US-22.1 CL.
 */
export const brandNameInvalidMessage = "Вкажіть назву бренду (2–50 символів)";

/**
 * Under «Сайт бренду» for PROFILE_INVALID on websiteUrl (registration and profile).
 * PROVISIONAL: no story gives this text (Q-08).
 */
export const websiteUrlInvalidMessage =
  "Вкажіть адресу сайту бренду, що починається з https://, наприклад https://brand.com.ua";

/**
 * The only place for Ukrainian error texts (api.md §3.2, ADR-0008).
 * A code added to ErrorCode without a text here fails the typecheck.
 */
export const messages: Record<ErrorCode, string> = {
  // Exact texts from the user stories — do not reword.
  EMAIL_TAKEN_OR_INVALID:
    "Цей email вже використовується або має некоректний формат", // US-21 S2
  // From the task text (ADR-0016): the buyer's «Email або номер телефону».
  LOGIN_INVALID: "Введіть email або номер телефону у форматі +380…",
  INVALID_CREDENTIALS: "Невірний email або пароль", // US-21.1 S2
  // Login: what exactly is wrong, under that field (ADR-0018)
  EMAIL_NOT_FOUND: "Акаунт з такою поштою не знайдено",
  WRONG_PASSWORD: "Неправильний пароль",
  BRAND_NAME_MISMATCH: "Назва бренду не збігається з вказаною при реєстрації",
  NAME_MISMATCH: "Імʼя не збігається з вказаним при реєстрації",
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
  // Brand site import (ADR-0017). PROVISIONAL: no story gives these texts (Q-08).
  SITE_NOT_SET: "Спочатку вкажіть сайт бренду в профілі",
  SITE_VERIFICATION_FAILED:
    "Не вдалося підтвердити сайт: мета-тег або файл з кодом не знайдено на головній сторінці. Перевірте, що зміни опубліковані, і спробуйте ще раз",
  SITE_NOT_VERIFIED: "Спочатку підтвердьте, що сайт належить вашому бренду",
  SITE_UNREACHABLE:
    "Не вдалося відкрити ваш сайт. Перевірте, що він працює, і спробуйте пізніше",
  SITE_ROBOTS_DISALLOWED:
    "Файл robots.txt вашого сайту забороняє FULLA-bot читати сторінки товарів",
  NO_PRODUCTS_FOUND:
    "На сайті не знайдено одягу: немає товарного фіду, Shopify-каталогу чи розмітки товарів. Додайте посилання на товарний фід",
  IMPORT_TOO_FREQUENT: "Імпорт можна запускати не частіше ніж раз на 10 хвилин",
  IMPORT_FAILED: "Імпорт перервався. Спробуйте запустити його ще раз",
  PRODUCT_NOT_ON_SITE: "Цього товару більше немає на сайті бренду",
  // From the task text (ADR-0012 limits), no story yet.
  FAVORITES_LIMIT_REACHED:
    "Вподобане заповнене (100 з 100). Видаліть кілька товарів, щоб додати нові.",
};

/**
 * Ukrainian plural form for a count: «1 товар», «3 товари», «5 товарів», «11 товарів»,
 * «21 товар». `forms` = [one, few, many].
 */
export function pluralUk(
  count: number,
  forms: readonly [one: string, few: string, many: string],
): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return forms[1];
  }
  return forms[2];
}

/** «1 товар», «3 товари», «5 товарів», «11 товарів», «21 товар». */
export function productsCount(count: number): string {
  return `${count} ${pluralUk(count, ["товар", "товари", "товарів"])}`;
}

/** «1 новий товар», «3 нові товари», «5 нових товарів». */
export function newProductsCount(count: number): string {
  const words = pluralUk(count, [
    "новий товар",
    "нові товари",
    "нових товарів",
  ]);
  return `${count} ${words}`;
}

/** «1 бренд», «3 бренди», «5 брендів». */
export function brandsCount(count: number): string {
  return `${count} ${pluralUk(count, ["бренд", "бренди", "брендів"])}`;
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

/** «Вподобане» is full (shared/FavoritesLimitDialog, the counter on /favorites). */
export const favoritesLimitTexts = {
  /** Non-breaking spaces in «(25 з 25)»: it never breaks over two lines. */
  title: (limit: number) =>
    `Вподобане заповнене (${limit}\u00A0з\u00A0${limit})`,
  guestText:
    "Щоб зберігати більше товарів, створіть акаунт. Або звільніть місце у вподобаному.",
  accountText: "Видаліть кілька товарів, щоб додати нові.",
  register: "Зареєструватися",
  toFavorites: "Перейти у вподобане",
  /** The ✕ in the corner (it replaced «Скасувати»). */
  close: "Закрити",
  /** Next to the «Вподобане» title: «18 з 25». */
  counter: (count: number, limit: number) => `${count} з ${limit}`,
  counterLabel: (count: number, limit: number) =>
    `Збережено ${count} з ${limit} можливих`,
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
  /** «+3» after the sizes that fit in one line on the front side. */
  moreSizes: (count: number) => `+${count}`,
  moreSizesLabel: (count: number) =>
    `Ще ${count} ${pluralUk(count, ["розмір", "розміри", "розмірів"])}`,
  outOfStock: "Немає в наявності",
  /** A sold-out size circle on the front side: «M, Немає в наявності». */
  soldOutSizeLabel: (label: string) => `${label}, Немає в наявності`,
  /**
   * A size with its red badge (1–4 items left, shared/sizes.ts lowStockQuantity), for screen
   * readers: «M, залишилось 2 шт.». Wording pending the team lead's confirmation.
   */
  lowStockSizeLabel: (label: string, count: number) =>
    `${label}, залишилось ${count} шт.`,
  /** The note next to such a size on the back side: «Залишилось 2 шт.». Same pending wording. */
  lowStockNote: (count: number) => `Залишилось ${count} шт.`,
  colors: "Колір",
  material: "Матеріал",
  description: "Опис",
  price: "Ціна",
  flip: "Перевернути",
  flipLabel: "Перевернути картку: деталі товару",
  back: "Назад до фото",
  backLabel: "Перевернути картку назад до фото",
  detailsTitle: "Деталі товару",
  noDetails: "Бренд ще не додав деталей до цього товару.",
  /** The small grey text instead of the circles when every size is sold out. */
  stockNone: "Немає в наявності",
  /** The label of the size circles: «Доступні розміри: S, M.» (the sizes in stock). */
  sizesInStockLabel: (labels: readonly string[]) =>
    `Доступні розміри: ${labels.join(", ")}.`,
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
  /** Filters on /feed (the same as in the catalogue, shared through the URL). */
  filtersEmpty: "За цими фільтрами нових карток немає",
  resetFilters: "Скинути фільтри",
  toCatalog: "Дивитися каталог",
  /** Announced (aria-live) after the filters change: unviewed cards that pass them. */
  cardsLeft: (count: number) =>
    pluralUk(count, [
      `Залишилась ${count} картка`,
      `Залишилось ${count} картки`,
      `Залишилось ${count} карток`,
    ]),
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
  sizeGroup: "Розмір",
  /** A size button: «Розмір M, 5 товарів». */
  sizeLabel: (size: string, count: number) =>
    `Розмір ${size}, ${productsCount(count)}`,
  sizeChip: (size: string) => `Розмір ${size}`,
  sizeChipLabel: (size: string) => `Скинути фільтр: розмір ${size}`,
  sizeListLabel: "Розміри в наявності",
  sizeEmpty: "Розмірів у наявності поки немає",
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
  /** «Бренди» block between the banner and «Усі товари» (catalog/BrandTiles). */
  brandsTitle: "Бренди",
  brandsCount: (count: number) => brandsCount(count),
  brandsAll: (count: number) => `Усі бренди (${count})`,
  brandsCollapse: "Згорнути",
  brandsLoading: "Завантажуємо бренди…",
  brandTileCount: (count: number) => productsCount(count),
  brandLogoAlt: (name: string) => `Логотип ${name}`,
  brandTileLabel: (name: string, count: number) =>
    `Бренд ${name}, ${productsCount(count)}`,
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
  /** Offered on / and /feed opened without filters while some are remembered. */
  restoreFilters: (labels: string) => `Повернути фільтри: ${labels}`,
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
  /** Under the password on both tabs; leads to /forgot-password (a stub for now). */
  forgotPassword: "Забули пароль?",
  /** The first field of each tab (2026-12-02): «Вхід» asks the name, «Вхід для бренду» the brand. */
  buyerName: "Ваше імʼя",
  brandName: "Назва бренду",
  brandNameRequired: "Введіть назву бренду",
  brandNameTooLong: "Назва бренду — до 50 символів",
  /** Before sending (ADR-0018): each under its own field. */
  emailRequired: "Введіть email",
  emailFormat: "Перевірте формат email",
  passwordRequired: "Введіть пароль",
  /** 429 on /login: once for the form. */
  tooManyAttempts: "Забагато спроб. Спробуйте за кілька хвилин",
  /** Next to EMAIL_NOT_FOUND under «Email». */
  registerLink: "Зареєструватися",
  tabsLabel: "Тип входу",
  buyerTab: "Вхід",
  brandTab: "Вхід для бренду",
  noAccount: "Немає акаунту?",
  registerBuyer: "Зареєструватися",
  registerBrand: "Зареєструвати бренд",
} as const;

/** Brand registration (/brand/register, US-21). */
export const brandRegisterTexts = {
  title: "Реєстрація бренду",
  /** The brand's contact person, the first field of the form. */
  contactName: "Ваше імʼя",
  name: "Назва бренду",
  website: "Сайт бренду",
  websitePlaceholder: "https://brand.com.ua",
  email: "Email",
  password: "Пароль",
  submit: "Зареєструвати бренд",
  submitting: "Реєструємо…",
  haveCabinet: "Вже маєте кабінет?",
  login: "Увійти",
} as const;

/** Buyer login (the «Вхід» tab of /login, US-03) and registration (/register, US-02). */
export const buyerAuthTexts = {
  email: "Email",
  password: "Пароль",
  confirmPassword: "Підтвердити пароль",
  /** /register (ADR-0016): the optional name and one field for email or phone. */
  nameLabel: "Імʼя",
  loginLabel: "Email або номер телефону",
  showPassword: "Показати пароль",
  login: "Увійти",
  loggingIn: "Входимо…",
  /** Shown instead of a request while POST /api/buyer/login does not exist (US-03). */
  loginSoon:
    "Вхід для покупців скоро запрацює. Поки що ти можеш свайпати й зберігати вподобане без акаунта.",
  registerTitle: "Реєстрація",
  /** The US-02 S1 button is «Зареєструватися»; the current design says «Створити акаунт». */
  createAccount: "Створити акаунт",
  creatingAccount: "Створюємо акаунт…",
  accountCreated: "Акаунт створено",
  passwordHint: (min: number) => `Мінімум ${min} символів`,
  /** US-02 CL: the note under the form. */
  privacyNote: "Ми зберігаємо вашу пошту та вподобані товари",
  haveAccount: "Вже є акаунт?",
  toLogin: "Увійти",
  // PROVISIONAL: no story gives these texts (Q-08); written for this form.
  emailRequired: "Введіть email",
  emailInvalid: "Введіть email у форматі name@mail.com",
  passwordRequired: "Введіть пароль",
  confirmRequired: "Підтвердіть пароль",
  loginInvalid: "Введіть email або номер телефону у форматі +380…",
  /** 409 at registration: one neutral text, it never says whether the email or the phone is taken. */
  loginTaken:
    "Цей email або номер телефону вже використовується або має некоректний формат",
  nameRequired: "Введіть імʼя",
  nameInvalid: "Імʼя — до 50 символів",
  loginRequired: "Введіть email або номер телефону",
  passwordsMismatch: "Паролі не збігаються",
  tooManyAttempts: "Забагато спроб, спробуйте пізніше",
  network: "Не вдалося з'єднатися, спробуйте ще раз",
} as const;

/**
 * /forgot-password: a stub without a server request until password reset exists (it is out
 * of the MVP, CLAUDE.md §1.2). PROVISIONAL texts, agreed in prompts/6.42.
 */
export const forgotPasswordTexts = {
  title: "Відновлення пароля",
  intro: "Введіть пошту, яку ви вказували при реєстрації",
  emailLabel: "Email",
  buyerLoginLabel: "Email або номер телефону",
  submit: "Надіслати",
  submitting: "Надсилаємо…",
  sent: "Скоро тут можна буде отримати лист для відновлення пароля. Поки що зверніться до команди FULLA.",
  backToLogin: "Повернутися до входу",
} as const;

/** Brand cabinet home page (/brand) and the «Додати товар» entry it shares with /brand/products. */
export const cabinetHomeTexts = {
  title: "Кабінет бренду",
  /** The profile header at the top of /brand. */
  noName: "Назва не вказана",
  addName: "Додати назву",
  logoAlt: (name: string) => `Логотип ${name}`,
  websiteLabel: (host: string) =>
    `Сайт бренду ${host} (відкриється в новій вкладці)`,
  consentGivenOn: (date: string) => `Згоду надано ${date}`,
  consentMissing: "Згоду не надано",
  /** Notice while there is no consent: publishing is refused (409 CONSENT_REQUIRED). */
  consentNoticeTitle: "Покупці поки не бачать ваших товарів",
  consentNoticeText:
    "Щойно ви підтвердите згоду на показ матеріалів, ви зможете публікувати товари, і вони з'являться в стрічці FULLA.",
  confirmConsent: "Підтвердити згоду",
  /** Notice while there is no name (older accounts). */
  nameNoticeTitle: "Спочатку збережіть назву бренду в профілі",
  nameNoticeText:
    "Без назви не можна створювати товари: покупці бачать її на кожній картці.",
  addProductNeedsName: "Щоб додати товар, спершу збережіть назву бренду",
  emptyProducts:
    "У вас поки немає товарів. Додайте перший — це займе кілька хвилин.",
  addProduct: "Додати товар",
  /** /brand/products: next to «Оновити з сайту». */
  addManually: "Додати вручну",
  fillProfile: "Заповнити профіль бренду",
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
} as const;

/** The error page of a route that crashed (shared/RouteError, errorElement in App.tsx). */
export const routeErrorTexts = {
  title: "Щось пішло не так",
  text: "Ця сторінка не змогла відкритися. Спробуйте ще раз — зазвичай це допомагає.",
  retry: "Спробувати ще раз",
  home: "На головну",
  cabinet: "До кабінету",
  details: "Деталі помилки (видно лише в режимі розробки)",
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

/** «Імпорт з сайту» on the cabinet home page (ADR-0017). PROVISIONAL texts. */
export const siteImportTexts = {
  title: "Імпорт з сайту",
  intro:
    "Перенесіть товари зі свого сайту в кабінет: вони з'являться як чернетки, і ви вирішите, що публікувати.",
  addWebsite: "Додайте сайт бренду в профілі",
  loading: "Завантаження…",
  /** Demo mode (profile dev, ADR-0017): no ownership check. */
  demoNote:
    "Демо-режим: товари імпортуються лише локально для розробки і не публікуються для покупців",
  stepVerify: "Крок 1. Підтвердіть, що сайт ваш",
  verifyIntro: (domain: string) =>
    `Оберіть один зі способів для ${domain}, потім натисніть «Перевірити».`,
  methodMeta: "Мета-тег на головній сторінці",
  methodMetaHint:
    "Додайте цей рядок у <head> головної сторінки сайту (у Shopify — Theme → Edit code → theme.liquid, у Horoshop і Prom — поле для коду в налаштуваннях сайту).",
  copy: "Скопіювати мета-тег",
  copied: "Скопійовано",
  copyFailed: "Не вдалося скопіювати — виділіть рядок і скопіюйте вручну",
  methodFile: "Файл fulla-verification.txt",
  methodFileHint: (domain: string) =>
    `Завантажте файл і розмістіть його так, щоб він відкривався за адресою https://${domain}/fulla-verification.txt.`,
  downloadFile: "Завантажити файл fulla-verification.txt",
  methodEmail: "Автоматично через пошту",
  methodEmailHint: (domain: string) =>
    `Якщо ви увійшли з адреси на домені ${domain} (наприклад info@${domain}), нічого додавати не треба — просто натисніть «Перевірити». Gmail, ukr.net, i.ua та інші публічні пошти не підходять.`,
  verify: "Перевірити",
  verifying: "Перевіряємо сайт…",
  verifiedOn: (domain: string, date: string) =>
    `Сайт ${domain} підтверджено ${date}`,
  importFrom: (domain: string) => `Імпортувати товари з ${domain}`,
  importStarting: "Запускаємо імпорт…",
  running:
    "Імпорт триває: читаємо товари з вашого сайту. Сторінкою можна користуватися далі.",
  summary: (s: {
    found: number;
    created: number;
    updated: number;
    skipped: number;
  }) =>
    `Знайдено ${s.found}, додано ${s.created} як чернетки, оновлено ${s.updated}, пропущено ${s.skipped} (не одяг або немає в наявності)`,
  hidden: (count: number) =>
    `Знято з публікації ${count} (розпродано або зникли з сайту)`,
  failed: "Імпорт не вдався",
  viewDrafts: "Переглянути чернетки",
  autoRefresh:
    "Ціни, розміри й наявність оновлюються автоматично. Нові товари з'являються як чернетки, а товари, яких більше немає на сайті, знімаються з публікації.",
  /** «Оновити з сайту зараз» (/brand/products and /brand): the same import, same rate limit. */
  syncNow: "Оновити з сайту",
  syncing: "Оновлюємо…",
  /** /brand/products, a website that is not verified yet (outside demo mode). */
  verifyFirst: "Підтвердіть, що сайт ваш, на головній кабінету",
  syncedAt: (when: string) => `Оновлено: ${when}`,
  neverSynced: "Ще не оновлювалося з сайту",
  syncFailed: "Останнє оновлення не вдалося",
  today: (time: string) => `сьогодні о ${time}`,
  yesterday: (time: string) => `вчора о ${time}`,
  onDate: (date: string, time: string) => `${date} о ${time}`,
  /** Only in the title of the disabled button while the 10-minute limit lasts. */
  syncAgainAt: (time: string) => `Оновити знову можна о ${time}`,
  feedLabel: "Посилання на товарний фід (необов'язково)",
  feedHint:
    "Товарний фід — це XML-файл з усіма товарами для Google Merchant або Facebook. Він дає найточніші дані. Де взяти: Horoshop — «Маркетинг → Експорт → Google Merchant»; Prom — «Налаштування → Експорт товарів → XML для Google»; Shopify — застосунок Google & YouTube (або залиште поле порожнім: Shopify-каталог ми знайдемо самі). Посилання має бути на домені вашого сайту.",
  feedInvalid: (domain: string) =>
    `Вкажіть посилання https:// на домені ${domain}`,
  saveFeed: "Зберегти посилання на фід",
  savingFeed: "Зберігаємо…",
  feedSaved: "Посилання на фід збережено",
} as const;

/** The brand's product list (/brand/products) and the card editor (ADR-0017 additions). */
export const brandProductsTexts = {
  title: "Товари бренду",
  /** document.title of /brand/products. */
  documentTitle: "Товари бренду — FULLA",
  documentTitleOf: (brand: string) => `Товари ${brand} — FULLA`,
  /** Left of the publish buttons: «47 товарів». */
  count: (count: number) =>
    `${count} ${pluralUk(count, ["товар", "товари", "товарів"])}`,
  empty: "У вас поки немає товарів",
  statusDraft: "Чернетка",
  statusPublished: "Опубліковано",
  statusNotOnSite: "Немає на сайті",
  /** Next to the disabled publish button and selection circle of a «Немає на сайті» card. */
  notOnSiteHint: "Цього товару більше немає на сайті бренду",
  removeFromList: "Прибрати зі списку",
  removeFromListOf: (name: string) => `Прибрати «${name}» зі списку`,
  removing: "Прибираємо…",
  /** «Опублікувати вибрані» with «Немає на сайті» cards among them. */
  skippedNotOnSite: (count: number) =>
    `${count} ${pluralUk(count, ["товар", "товари", "товарів"])} пропущено: ${pluralUk(count, ["його", "їх", "їх"])} немає на сайті`,
  selectAll: "Вибрати всі товари на сторінці",
  select: (name: string) => `Вибрати «${name}»`,
  publishSelected: (count: number) => `Опублікувати вибрані (${count})`,
  publishAll: (count: number) => `Опублікувати всі чернетки (${count})`,
  /** Published → Draft (US-31 CL), one card or the selected ones; both ask first. */
  unpublish: "Зняти з публікації",
  unpublishSelected: (count: number) => `Зняти вибрані з публікації (${count})`,
  unpublishing: "Знімаємо…",
  unpublishQuestion:
    "Зняти товар з публікації? Покупці більше не побачать його в стрічці й каталозі.",
  unpublishConfirm: "Зняти",
  unpublished: (count: number) => `Знято з публікації товарів: ${count}`,
  publishing: "Публікуємо…",
  published: (count: number) => `Опубліковано товарів: ${count}`,
  skipped: (count: number) =>
    `Не опубліковано: ${count} (вже опубліковані або змінилися — оновіть список)`,
  consentLink: "Підтвердити згоду",
  edit: (name: string) => `Редагувати «${name}»`,
  editShort: "Редагувати",
} as const;

/** The card editor (/brand/products/:id). */
export const editProductTexts = {
  title: "Редагування товару",
  notFound: "Товар не знайдено. Можливо, його вже немає у вашому списку.",
  publishedReadOnly:
    "Опубліковану картку не можна редагувати. Спочатку зніміть її з публікації.",
  editedField: "змінено вручну, не оновлюється з сайту",
  importedNote:
    "Цей товар імпортовано з вашого сайту. Поля, які ви зміните тут, більше не оновлюватимуться з сайту; розміри й наявність оновлюються як і раніше.",
  keepPhoto: "Поточне фото залишиться, якщо не вибрати нове",
  save: "Зберегти зміни",
  saving: "Зберігаємо…",
} as const;
