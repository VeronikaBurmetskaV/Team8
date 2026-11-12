import type { CreateProductRequest } from "../../api/types";
import { toFormErrors, type FormErrors } from "../../shared/errors";
import type { CardFormValues } from "../../shared/validation";

/** The inputs of the card form that can show an error, in form order. */
export const cardFormFields = [
  "name",
  "priceUah",
  "photo",
  "productUrl",
] as const;

export type CardFormField = (typeof cardFormFields)[number];

/** Request field of POST /api/brand/products → the input that shows its error. */
const fieldByRequestName: Partial<Record<string, CardFormField>> = {
  name: "name",
  priceUah: "priceUah",
  photoImageId: "photo",
  photoUrl: "photo",
  productUrl: "productUrl",
};

/** A failed save of the card, spread over the inputs of the form. */
export function toCardFormErrors(error: unknown): FormErrors<CardFormField> {
  const errors = toFormErrors(error, fieldByRequestName);
  // A rejected upload (POST /api/images) has no `fields`: it belongs to the photo.
  if (errors.form === "IMAGE_INVALID") {
    return { fields: { photo: "IMAGE_INVALID" }, form: null };
  }
  return errors;
}

/**
 * Body of POST /api/brand/products from the validated form values. `photoImageId` is the
 * id of the uploaded file, or null when the brand gave an image URL: exactly one of
 * photoImageId / photoUrl is set (api.md §4.1).
 */
export function toCreateProductRequest(
  values: CardFormValues,
  photoImageId: string | null,
): CreateProductRequest {
  return {
    name: values.name,
    priceUah: Number(values.priceUah),
    photoImageId,
    photoUrl: photoImageId === null ? values.photo.url : null,
    productUrl: values.productUrl,
  };
}
