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
