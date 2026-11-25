import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import {
  FieldError,
  LiveMessage,
  SubmitButton,
  describedBy,
} from "../../shared/auth/FormMessage";
import { PasswordInput } from "../../shared/auth/PasswordInput";
import { brandRegisterTexts as t } from "../../shared/messages.uk";
import {
  brandRegisterSchema,
  cleanWebsiteUrl,
  type BrandRegisterForm,
} from "../../shared/validation";
import { useRegisterBrand } from "./api";
import { pathAfterLogin } from "./pathAfterLogin";
import { brandRegisterErrors, REGISTER_FIELDS } from "./registerErrors";
import styles from "../../shared/auth/AuthForm.module.css";

/**
 * /brand/register (US-21): the contact person («Ваше імʼя»), brand name, website, email and
 * password. The name and website go
 * straight to the profile, so the new brand is ACTIVE (domain-model.md §4.1). The website is
 * only stored: the server never requests it (A-15).
 */
export function BrandRegisterPage() {
  const navigate = useNavigate();
  const registerBrand = useRegisterBrand();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BrandRegisterForm>({
    resolver: zodResolver(brandRegisterSchema),
    defaultValues: {
      contactName: "",
      name: "",
      websiteUrl: "",
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: BrandRegisterForm) {
    try {
      await registerBrand.mutateAsync(values);
      // The cabinet home page (US-21 CL).
      navigate(pathAfterLogin());
    } catch (error) {
      // The entered data stays in the form on any error (US-21 S2); focus on the first wrong field.
      const { fields, form } = brandRegisterErrors(error);
      const first = REGISTER_FIELDS.find(
        (field) => fields[field] !== undefined,
      );
      for (const field of REGISTER_FIELDS) {
        const message = fields[field];
        if (message !== undefined) {
          setError(field, { message }, { shouldFocus: field === first });
        }
      }
      if (form !== null) setError("root", { message: form });
    }
  }

  const websiteField = register("websiteUrl", {
    // On blur: «brand.com.ua» → «https://brand.com.ua», and tracking parameters
    // (srsltid, utm_*, fbclid, gclid) are removed, so the field shows what is saved.
    onBlur: (event: { target: { value: string } }) => {
      const value = cleanWebsiteUrl(event.target.value);
      if (value !== event.target.value) {
        setValue("websiteUrl", value, { shouldDirty: true });
      }
    },
  });

  return (
    <div className={styles.page}>
      <h1 className={`${styles.title} ${styles.titleCentered}`}>{t.title}</h1>
      <div className={styles.card}>
        <form
          className={styles.form}
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <div className={styles.field}>
            <label htmlFor="brand-contact-name">{t.contactName}</label>
            <input
              id="brand-contact-name"
              type="text"
              autoComplete="name"
              aria-invalid={errors.contactName ? true : undefined}
              aria-describedby={describedBy(
                errors.contactName && "brand-contact-name-error",
              )}
              {...register("contactName")}
            />
            <FieldError
              id="brand-contact-name-error"
              message={errors.contactName?.message}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="brand-name">{t.name}</label>
            <input
              id="brand-name"
              type="text"
              autoComplete="organization"
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={describedBy(errors.name && "brand-name-error")}
              {...register("name")}
            />
            <FieldError id="brand-name-error" message={errors.name?.message} />
          </div>
          <div className={styles.field}>
            <label htmlFor="brand-website">{t.website}</label>
            <input
              id="brand-website"
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder={t.websitePlaceholder}
              aria-invalid={errors.websiteUrl ? true : undefined}
              aria-describedby={describedBy(
                errors.websiteUrl && "brand-website-error",
              )}
              {...websiteField}
            />
            <FieldError
              id="brand-website-error"
              message={errors.websiteUrl?.message}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="email">{t.email}</label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={describedBy(errors.email && "email-error")}
              {...register("email")}
            />
            <FieldError id="email-error" message={errors.email?.message} />
          </div>
          <div className={styles.field}>
            <label htmlFor="password">{t.password}</label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={describedBy(
                errors.password && "password-error",
              )}
              {...register("password")}
            />
            <FieldError
              id="password-error"
              message={errors.password?.message}
            />
          </div>
          <div className={styles.actions}>
            <SubmitButton
              busy={isSubmitting}
              label={t.submit}
              busyLabel={t.submitting}
            />
            <LiveMessage role="alert" className={styles.error}>
              {errors.root?.message ?? null}
            </LiveMessage>
          </div>
        </form>
        <p className={styles.footer}>
          {t.haveCabinet} <Link to="/login?tab=brand">{t.login}</Link>
        </p>
      </div>
    </div>
  );
}
