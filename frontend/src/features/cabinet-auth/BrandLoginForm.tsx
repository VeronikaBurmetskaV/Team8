import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { errorMessage } from "../../shared/errors";
import {
  brandLoginSchema,
  type BrandLoginForm as BrandLoginValues,
} from "../../shared/validation";
import { useLoginBrand } from "./api";
import { pathAfterLogin } from "./pathAfterLogin";
import { LiveMessage, SubmitButton } from "../../shared/auth/FormMessage";
import { PasswordInput } from "../../shared/auth/PasswordInput";
import styles from "../../shared/auth/AuthForm.module.css";

/**
 * Brand login form (US-21.1): email + password, one common error, redirect after success.
 * Rendered inside the «Вхід для бренду» tab of /login; the page owns the card around it.
 */
export function BrandLoginForm() {
  const navigate = useNavigate();
  const loginBrand = useLoginBrand();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BrandLoginValues>({
    resolver: zodResolver(brandLoginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(credentials: BrandLoginValues) {
    try {
      await loginBrand.mutateAsync(credentials);
      // The cabinet home page; it leads to the profile while the brand has no name (US-21.1 CL).
      navigate(pathAfterLogin());
    } catch (error) {
      // The entered email stays in the form (US-21.1 S2).
      setError("root", { message: errorMessage(error) });
    }
  }

  // One common message, never under a field: no hint which one is wrong (US-21.1 CL).
  const errorText =
    errors.email?.message ?? errors.password?.message ?? errors.root?.message;

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className={styles.field}>
        <label htmlFor="brand-email">Email</label>
        <input
          id="brand-email"
          type="email"
          autoComplete="email"
          {...register("email")}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="brand-password">Пароль</label>
        <PasswordInput
          id="brand-password"
          autoComplete="current-password"
          {...register("password")}
        />
      </div>
      <div className={styles.actions}>
        <SubmitButton busy={isSubmitting} label="Увійти" busyLabel="Входимо…" />
        <LiveMessage role="alert" className={styles.error}>
          {errorText ?? null}
        </LiveMessage>
      </div>
    </form>
  );
}
