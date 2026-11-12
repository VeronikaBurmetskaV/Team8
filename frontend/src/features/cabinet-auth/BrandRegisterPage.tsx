import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { toFormErrors } from "../../shared/errors";
import { messages } from "../../shared/messages.uk";
import {
  brandRegisterSchema,
  type BrandRegisterForm,
} from "../../shared/validation";
import { useRegisterBrand } from "./api";
import { pathAfterLogin } from "./pathAfterLogin";
import styles from "./BrandRegisterPage.module.css";

/** Request field of POST /api/brand/register → the input that shows its error (US-21 S2). */
const registerFields = { email: "email", password: "password" } as const;

export function BrandRegisterPage() {
  const navigate = useNavigate();
  const registerBrand = useRegisterBrand();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BrandRegisterForm>({
    resolver: zodResolver(brandRegisterSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(credentials: BrandRegisterForm) {
    try {
      const brand = await registerBrand.mutateAsync(credentials);
      // A new brand has no name yet, so it goes to the profile (US-21 CL).
      navigate(pathAfterLogin(brand.profileState));
    } catch (error) {
      // The entered data stays in the form on any error (US-21 S2).
      showError(error);
    }
  }

  function showError(error: unknown) {
    const { fields, form } = toFormErrors(error, registerFields);
    if (fields.email) setError("email", { message: messages[fields.email] });
    if (fields.password) {
      setError("password", { message: messages[fields.password] });
    }
    if (form) setError("root", { message: messages[form] });
  }

  return (
    <>
      <h1 className={styles.title}>Реєстрація бренду</h1>
      <form
        className={styles.card}
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
        <div className={styles.field}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "email-error" : undefined}
            {...register("email")}
          />
          {errors.email && (
            <p id="email-error" className={styles.fieldError} role="alert">
              {errors.email.message}
            </p>
          )}
        </div>
        <div className={styles.field}>
          <label htmlFor="password">Пароль</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "password-error" : undefined}
            {...register("password")}
          />
          {errors.password && (
            <p id="password-error" className={styles.fieldError} role="alert">
              {errors.password.message}
            </p>
          )}
        </div>
        <button className={styles.submit} type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Реєструємо…" : "Зареєструвати бренд"}
        </button>
        {errors.root && (
          <p className={styles.error} role="alert">
            {errors.root.message}
          </p>
        )}
      </form>
      <p className={styles.switch}>
        Вже маєте кабінет? <Link to="/brand/login">Увійти</Link>
      </p>
    </>
  );
}
