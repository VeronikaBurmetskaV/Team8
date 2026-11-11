import type { ErrorCode } from "../api/types";

/** For codes that have no story text yet (api.md §3.2 "—", overview Q-08). */
const GENERIC = "Не вдалося виконати дію. Перевірте дані та спробуйте ще раз";

/** The only place for Ukrainian error texts; copied verbatim from api.md §3.2. */
export const messagesUk: Record<ErrorCode, string> = {
  VALIDATION_FAILED: GENERIC,
  EMAIL_TAKEN_OR_INVALID:
    "Цей email вже використовується або має некоректний формат",
  PASSWORD_TOO_SHORT: GENERIC,
  INVALID_CREDENTIALS: "Невірний email або пароль",
  UNAUTHENTICATED: GENERIC,
  FORBIDDEN: GENERIC,
  NOT_FOUND: GENERIC,
  PROFILE_INVALID:
    "Вкажіть назву бренду та завантажте зображення у форматі JPG, PNG або WEBP",
  CONSENT_LOCKED: GENERIC,
  PROFILE_INCOMPLETE: GENERIC,
  IMAGE_INVALID: GENERIC,
  CARD_INVALID_NAME: GENERIC,
  CARD_INVALID_PRICE_OR_PHOTO:
    "Вкажіть коректну ціну більше нуля та додайте фотографію товару",
  CARD_INVALID_URL:
    "Введіть повне посилання на сторінку товару, що починається з https:// або http://",
  CARD_NOT_EDITABLE: GENERIC,
  CONSENT_REQUIRED:
    "Для показу товарів на платформі необхідно підтвердити згоду на демонстрацію матеріалів бренду",
  PUBLISH_FIELDS_MISSING:
    "Заповніть усі обов'язкові поля картки (назва, фото, ціна, посилання) перед публікацією",
  INVALID_STATE: GENERIC,
  TOO_MANY_REQUESTS: GENERIC,
  SERVICE_UNAVAILABLE: GENERIC,
};

/** Text for a code that arrives as a plain string (form libraries, unknown codes). */
export function errorText(code: string): string {
  return Object.hasOwn(messagesUk, code)
    ? messagesUk[code as ErrorCode]
    : GENERIC;
}
