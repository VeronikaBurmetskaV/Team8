import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { loginTexts } from "../../shared/messages.uk";
import {
  forgotPasswordPath,
  registerPath,
  showLoginError,
} from "../buyer-auth/loginTabs";
import {
  brandLoginSchema,
  type BrandLoginForm as BrandLoginValues,
} from "../../shared/validation";
import { useLoginBrand } from "./api";
import { pathAfterLogin } from "./pathAfterLogin";
import {
  FieldError,
  LiveMessage,
  SubmitButton,
  describedBy,
} from "../../shared/auth/FormMessage";
import { PasswordInput } from "../../shared/auth/PasswordInput";
import styles from "../../shared/auth/AuthForm.module.css";

/**
 * Brand login form (US-21.1): «Назва бренду» (2026-12-02), email and password; redirect after
 * success. Every error is shown under its own field, also the server's (ADR-0018): an unknown
 * email with «Зареєструватися», a wrong password next to «Забули пароль?», a name that differs.
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
    defaultValues: { brandName: "", email: "", password: "" },
  });

  async function onSubmit(credentials: BrandLoginValues) {
    try {
      await loginBrand.mutateAsync(credentials);
      // The cabinet home page; it leads to the profile while the brand has no name (US-21.1 CL).
      navigate(pathAfterLogin());
    } catch (error) {
      // The entered data stays in the form (US-21.1 S2); the focus goes to the wrong field.
      showLoginError<keyof BrandLoginValues>(error, "brand", setError);
    }
  }

  const nameError = errors.brandName?.message;
  const emailError = errors.email?.message;
  const passwordError = errors.password?.message;

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className={styles.field}>
        <label htmlFor="brand-login-name">{loginTexts.brandName}</label>
        <input
          id="brand-login-name"
          type="text"
          autoComplete="organization"
          aria-invalid={nameError ? true : undefined}
          aria-describedby={describedBy(nameError && "brand-login-name-error")}
          {...register("brandName")}
        />
        <FieldError id="brand-login-name-error" message={nameError} />
      </div>
      <div className={styles.field}>
        <label htmlFor="brand-email">Email</label>
        <input
          id="brand-email"
          type="email"
          autoComplete="email"
          aria-invalid={emailError ? true : undefined}
          aria-describedby={describedBy(emailError && "brand-email-error")}
          {...register("email")}
        />
        <FieldError
          id="brand-email-error"
          message={emailError}
          action={
            errors.email?.type === "EMAIL_NOT_FOUND" && (
              <Link to={registerPath("brand")}>{loginTexts.registerLink}</Link>
            )
          }
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="brand-password">Пароль</label>
        <PasswordInput
          id="brand-password"
          autoComplete="current-password"
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={describedBy(
            passwordError && "brand-password-error",
          )}
          {...register("password")}
        />
        <FieldError id="brand-password-error" message={passwordError} />
        {/* Right under a «Неправильний пароль»: the way out is next to it. */}
        <p className={styles.forgot}>
          <Link to={forgotPasswordPath("brand")} className={styles.forgotLink}>
            {loginTexts.forgotPassword}
          </Link>
        </p>
      </div>
      <div className={styles.actions}>
        <SubmitButton busy={isSubmitting} label="Увійти" busyLabel="Входимо…" />
        {/* Only 429 and unexpected errors: everything else is under its field. */}
        <LiveMessage role="alert" className={styles.error}>
          {errors.root?.message ?? null}
        </LiveMessage>
      </div>
    </form>
  );
}
