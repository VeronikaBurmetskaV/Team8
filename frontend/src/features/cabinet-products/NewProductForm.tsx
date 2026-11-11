import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router";
import { ApiError } from "../../api/client";
import type { ErrorCode } from "../../api/types";
import { errorText } from "../../shared/messages.uk";
import {
  cardFormSchema,
  IMAGE_MIME_TYPES,
  isHttpUrl,
  type CardFormValues,
} from "../../shared/validation";
import { useCreateBrandProduct } from "./queries";
import styles from "./NewProductForm.module.css";

type FormField = "name" | "priceUah" | "photo" | "productUrl";

/** Request field of POST /api/brand/products → the input that shows its error. */
const fieldByRequestName: Partial<Record<string, FormField>> = {
  name: "name",
  priceUah: "priceUah",
  photoImageId: "photo",
  photoUrl: "photo",
  productUrl: "productUrl",
};

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

export function NewProductForm() {
  const navigate = useNavigate();
  const createProduct = useCreateBrandProduct();
  const [formError, setFormError] = useState<ErrorCode | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitted, isSubmitting },
  } = useForm<CardFormValues>({
    resolver: zodResolver(cardFormSchema),
    defaultValues: {
      name: "",
      priceUah: "",
      photo: { file: null, url: "" },
      productUrl: "",
    },
  });

  const productUrl = useWatch({ control, name: "productUrl" }).trim();
  const canCheckLink = isHttpUrl(productUrl);

  function showServerError(error: ApiError) {
    let shownAtField = false;
    for (const [requestName, code] of Object.entries(error.fields)) {
      const field = fieldByRequestName[requestName];
      if (field && code) {
        setError(field, { type: "server", message: code });
        shownAtField = true;
      }
    }
    if (shownAtField) return;
    if (error.code === "IMAGE_INVALID") {
      setError("photo", { type: "server", message: error.code });
    } else {
      setFormError(error.code);
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await createProduct.mutateAsync(values);
    } catch (error) {
      // Entered data stays in the form on any failure.
      if (error instanceof ApiError) showServerError(error);
      else setFormError("SERVICE_UNAVAILABLE");
      return;
    }
    await navigate("/brand/products");
  });

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Новий товар</h1>

      <form
        className={styles.form}
        onSubmit={(event) => void onSubmit(event)}
        noValidate
      >
        <div>
          <label htmlFor="card-name">Назва товару</label>
          <input
            id="card-name"
            type="text"
            maxLength={100}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby="card-name-error"
            {...register("name")}
          />
          <FieldError id="card-name-error" code={errors.name?.message} />
        </div>

        <div>
          <label htmlFor="card-price">Ціна в грн</label>
          <input
            id="card-price"
            type="text"
            inputMode="numeric"
            aria-invalid={errors.priceUah ? true : undefined}
            aria-describedby="card-price-error"
            {...register("priceUah")}
          />
          <FieldError id="card-price-error" code={errors.priceUah?.message} />
        </div>

        <fieldset
          className={styles.photoGroup}
          aria-describedby="card-photo-error"
        >
          <legend className={styles.legend}>Фотографія товару</legend>
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

        <div>
          <label htmlFor="card-product-url">
            Посилання на товар на сайті бренду (URL)
          </label>
          <input
            id="card-product-url"
            type="url"
            aria-invalid={errors.productUrl ? true : undefined}
            aria-describedby="card-product-url-error"
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
          <FieldError
            id="card-product-url-error"
            code={errors.productUrl?.message}
          />
        </div>

        {formError && (
          <p role="alert">
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
          Зберегти чернетку
        </button>
      </form>

      <Link className={styles.backLink} to="/brand/products">
        До списку товарів
      </Link>
    </section>
  );
}
