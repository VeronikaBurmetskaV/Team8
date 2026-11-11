import { z } from "zod";
import type { ErrorCode } from "../api/types";

// Mirrors the backend Bean Validation rules for instant feedback (api.md §1).
// Every issue message is an ErrorCode; the texts live in messages.uk.ts.

export const IMAGE_MAX_BYTES = 5_242_880;
export const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const PRICE_MAX_UAH = 1_000_000;

const NAME: ErrorCode = "CARD_INVALID_NAME";
const PRICE_OR_PHOTO: ErrorCode = "CARD_INVALID_PRICE_OR_PHOTO";
const URL_CODE: ErrorCode = "CARD_INVALID_URL";

function isUrlWithScheme(value: string, schemes: RegExp): boolean {
  if (!schemes.test(value) || /\s/.test(value)) return false;
  try {
    return new URL(value).hostname !== "";
  } catch {
    return false;
  }
}

/** Absolute URL with scheme http/https and a non-empty host (US-26). */
export function isHttpUrl(value: string): boolean {
  return isUrlWithScheme(value, /^https?:\/\//i);
}

/** External image URL: `https://` only (ADR-0007). */
export function isHttpsUrl(value: string): boolean {
  return isUrlWithScheme(value, /^https:\/\//i);
}

/** Whole positive number of UAH typed into the price field. */
export function isValidPrice(value: string): boolean {
  if (!/^\d+$/.test(value)) return false;
  const price = Number(value);
  return price > 0 && price <= PRICE_MAX_UAH;
}

/** Exactly one of: an uploaded file or an https:// image URL (api.md §4.1). */
const photoSchema = z
  .object({
    file: z.custom<File>((value) => value instanceof File).nullable(),
    url: z.string().trim(),
  })
  .refine(
    ({ file, url }) => {
      if (file !== null && url !== "") return false;
      if (file !== null) {
        return (
          IMAGE_MIME_TYPES.includes(file.type) &&
          file.size > 0 &&
          file.size <= IMAGE_MAX_BYTES
        );
      }
      return isHttpsUrl(url);
    },
    { message: PRICE_OR_PHOTO },
  );

/** The card form (US-25.1, US-26), fields in the order of the form. */
export const cardFormSchema = z.object({
  name: z.string().trim().min(1, NAME).max(100, NAME),
  priceUah: z.string().trim().refine(isValidPrice, { message: PRICE_OR_PHOTO }),
  photo: photoSchema,
  productUrl: z.string().trim().refine(isHttpUrl, { message: URL_CODE }),
});

export type CardFormValues = z.infer<typeof cardFormSchema>;
