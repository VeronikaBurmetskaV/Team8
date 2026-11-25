import { useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router";
import type { EditedField, ErrorCode } from "../../api/types";
import { editProductTexts, errorText } from "../../shared/messages.uk";
import {
  cardFormSchema,
  editCardFormSchema,
  IMAGE_MIME_TYPES,
  isHttpUrl,
  type CardFormValues,
} from "../../shared/validation";
import { cardFormFields, toCardFormErrors } from "./cardForm";
import styles from "./NewProductForm.module.css";

/** In the card form a rejected upload shows the US-25.1 S2 text (overview Q-08). */
function fieldText(code: string | undefined): string | null {
  if (!code) return null;
  return errorText(
    code === "IMAGE_INVALID" ? "CARD_INVALID_PRICE_OR_PHOTO" : code,
  );
}

function FieldError({ id, code }: { id: string; code: string | undefined }) {
  const text = fieldText(code);
  if (!text) return null;
  return (
    <p id={id} role="alert">
      {text}
    </p>
  );
}

/** «змінено вручну, не оновлюється з сайту» next to a label of an imported card (ADR-0017). */
function EditedMark({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className={styles.editedMark}>{editProductTexts.editedField}</span>
  );
}

type Props = {
  title: string;
  submitLabel: string;
  defaultValues: CardFormValues;
  /** The resolver's schema; editing may keep an uploaded photo (editCardFormSchema). */
  schema?: typeof cardFormSchema | ReturnType<typeof editCardFormSchema>;
  /** Saves the values; throws the API error to show it at the fields. */
  onSave: (values: CardFormValues) => Promise<void>;
  /** Fields of an imported card the brand already edited by hand. */
  editedFields?: readonly EditedField[];
  /** Extra text above the fields (e.g. the note about imported cards). */
  note?: ReactNode;
  /** Hint under the photo inputs (e.g. «the current photo stays»). */
  photoHint?: string;
};

/**
 * The card form of US-25.1 and US-26 S1: create and edit share it. Entered data stays in the
 * form on any failure; the server's field errors are shown under the fields.
 */
export function ProductForm({
  title,
  submitLabel,
  defaultValues,
  schema = cardFormSchema,
  onSave,
  editedFields = [],
  note,
  photoHint,
}: Props) {
  const [formError, setFormError] = useState<ErrorCode | null>(null);
  const edited = new Set(editedFields);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitted, isSubmitting },
  } = useForm<CardFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const productUrl = useWatch({ control, name: "productUrl" }).trim();
  const canCheckLink = isHttpUrl(productUrl);

  function showError(error: unknown) {
    const { fields, form } = toCardFormErrors(error);
    for (const field of cardFormFields) {
      const code = fields[field];
      if (code) setError(field, { type: "server", message: code });
    }
    setFormError(form);
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onSave(values);
    } catch (error) {
      showError(error);
    }
  });

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>{title}</h1>
      {note && <p className={styles.note}>{note}</p>}

      <form
        className={styles.form}
        onSubmit={(event) => void onSubmit(event)}
        noValidate
      >
        <div className={styles.nameField}>
          <label htmlFor="card-name">
            Назва товару <EditedMark show={edited.has("name")} />
          </label>
          <input
            id="card-name"
            type="text"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? "card-name-error" : undefined}
            {...register("name")}
          />
          <FieldError id="card-name-error" code={errors.name?.message} />
        </div>

        <div className={styles.priceField}>
          <label htmlFor="card-price">
            Ціна в грн <EditedMark show={edited.has("priceUah")} />
          </label>
          <input
            id="card-price"
            type="text"
            inputMode="numeric"
            aria-invalid={errors.priceUah ? true : undefined}
            aria-describedby={errors.priceUah ? "card-price-error" : undefined}
            {...register("priceUah")}
          />
          <FieldError id="card-price-error" code={errors.priceUah?.message} />
        </div>

        <fieldset
          className={styles.photoGroup}
          aria-describedby={errors.photo ? "card-photo-error" : undefined}
        >
          <legend className={styles.legend}>
            Фотографія товару <EditedMark show={edited.has("photo")} />
          </legend>
          {photoHint && <p className={styles.photoHint}>{photoHint}</p>}
          <div>
            <label htmlFor="card-photo-file">
              Файл PNG, JPG або WEBP до 5 МБ
            </label>
            <input
              id="card-photo-file"
              className={styles.fileInput}
              type="file"
              accept={IMAGE_MIME_TYPES.join(",")}
              onChange={(event) =>
                setValue("photo.file", event.target.files?.[0] ?? null, {
                  shouldValidate: isSubmitted,
                })
              }
            />
          </div>
          <div>
            <label htmlFor="card-photo-url">
              або URL зображення, що починається з https://
            </label>
            <input id="card-photo-url" type="url" {...register("photo.url")} />
          </div>
          <FieldError id="card-photo-error" code={errors.photo?.message} />
        </fieldset>

        <div className={styles.urlField}>
          <label htmlFor="card-product-url">
            Посилання на товар на сайті бренду (URL){" "}
            <EditedMark show={edited.has("productUrl")} />
          </label>
          <div className={styles.urlRow}>
            <input
              id="card-product-url"
              type="url"
              aria-invalid={errors.productUrl ? true : undefined}
              aria-describedby={
                errors.productUrl ? "card-product-url-error" : undefined
              }
              {...register("productUrl")}
            />
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={!canCheckLink}
              onClick={() =>
                window.open(productUrl, "_blank", "noopener,noreferrer")
              }
            >
              Перевірити посилання
            </button>
          </div>
          <FieldError
            id="card-product-url-error"
            code={errors.productUrl?.message}
          />
        </div>

        {formError && (
          <p className={styles.formError} role="alert">
            {errorText(formError)}
            {formError === "PROFILE_INCOMPLETE" && (
              <>
                {" "}
                <Link to="/brand/profile">Заповнити профіль бренду</Link>
              </>
            )}
          </p>
        )}

        <button className={styles.submit} type="submit" disabled={isSubmitting}>
          {isSubmitting ? editProductTexts.saving : submitLabel}
        </button>
      </form>

      <Link className={styles.backLink} to="/brand/products">
        До списку товарів
      </Link>
    </section>
  );
}
