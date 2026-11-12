import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { ApiError } from "../../api/client";
import { messages } from "../../shared/messages.uk";
import {
  brandRegisterSchema,
  type BrandRegisterForm,
} from "../../shared/validation";
import { useRegisterBrand } from "./api";
import styles from "./BrandRegisterPage.module.css";

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
      navigate(
        brand.profileState === "INCOMPLETE"
          ? "/brand/profile"
          : "/brand/products",
      );
    } catch (error) {
      // The entered data stays in the form on any error (US-21 S2).
      showError(error);
    }
  }

  function showError(error: unknown) {
    if (!(error instanceof ApiError)) {
      setError("root", { message: messages.SERVICE_UNAVAILABLE });
      return;
    }
    const { email, password } = error.fields;
    if (email) setError("email", { message: messages[email] });
    if (password) setError("password", { message: messages[password] });
    if (!email && !password) {
      setError("root", { message: messages[error.code] });
    }
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
        {errors.root && (
          <p className={styles.error} role="alert">
            {errors.root.message}
          </p>
        )}
        <button className={styles.submit} type="submit" disabled={isSubmitting}>
          Зареєструвати бренд
        </button>
      </form>
    </>
  );
}
