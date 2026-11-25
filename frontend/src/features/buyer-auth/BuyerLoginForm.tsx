import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import {
  FieldError,
  LiveMessage,
  SubmitButton,
  describedBy,
} from "../../shared/auth/FormMessage";
import { PasswordInput } from "../../shared/auth/PasswordInput";
import { buyerAuthTexts as t, loginTexts } from "../../shared/messages.uk";
import {
  buyerLoginSchema,
  type BuyerLoginForm as BuyerLoginValues,
} from "../../shared/validation";
import { useBuyerLogin } from "./api";
import { forgotPasswordPath, registerPath, showLoginError } from "./loginTabs";
import styles from "../../shared/auth/AuthForm.module.css";

/**
 * Buyer login form (US-03), the «Вхід» tab of /login. Field errors come from zod; the press
 * of «Увійти» goes through useBuyerLogin, which for now only answers «скоро запрацює».
 */
export function BuyerLoginForm() {
  const login = useBuyerLogin();
  const [notice, setNotice] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BuyerLoginValues>({
    resolver: zodResolver(buyerLoginSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  async function onSubmit(credentials: BuyerLoginValues) {
    setNotice(null);
    try {
      const result = await login.mutateAsync(credentials);
      if (result.status === "soon") setNotice(t.loginSoon);
    } catch (error) {
      // The entered data stays in the form (US-03 S2); a wrong combination never says which
      // field is wrong (US-03 CL).
      // Under its field with the focus there (ADR-0018), once the endpoint exists.
      showLoginError<keyof BuyerLoginValues>(error, "buyer", setError);
    }
  }

  const nameError = errors.name?.message;
  const emailError = errors.email?.message;
  const passwordError = errors.password?.message;

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className={styles.field}>
        <label htmlFor="buyer-name">{loginTexts.buyerName}</label>
        <input
          id="buyer-name"
          type="text"
          autoComplete="given-name"
          aria-invalid={nameError ? true : undefined}
          aria-describedby={describedBy(nameError && "buyer-name-error")}
          {...register("name")}
        />
        <FieldError id="buyer-name-error" message={nameError} />
      </div>
      <div className={styles.field}>
        <label htmlFor="buyer-email">{t.email}</label>
        <input
          id="buyer-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          aria-invalid={emailError ? true : undefined}
          aria-describedby={describedBy(emailError && "buyer-email-error")}
          {...register("email")}
        />
        <FieldError
          id="buyer-email-error"
          message={emailError}
          action={
            errors.email?.type === "EMAIL_NOT_FOUND" && (
              <Link to={registerPath("buyer")}>{loginTexts.registerLink}</Link>
            )
          }
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="buyer-password">{t.password}</label>
        <PasswordInput
          id="buyer-password"
          autoComplete="current-password"
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={describedBy(
            passwordError && "buyer-password-error",
          )}
          {...register("password")}
        />
        <FieldError id="buyer-password-error" message={passwordError} />
        <p className={styles.forgot}>
          <Link to={forgotPasswordPath("buyer")} className={styles.forgotLink}>
            {loginTexts.forgotPassword}
          </Link>
        </p>
      </div>
      <div className={styles.actions}>
        <SubmitButton
          busy={isSubmitting}
          label={t.login}
          busyLabel={t.loggingIn}
        />
        <LiveMessage role="alert" className={styles.error}>
          {errors.root?.message ?? null}
        </LiveMessage>
        <LiveMessage role="status" className={styles.notice}>
          {notice}
        </LiveMessage>
      </div>
    </form>
  );
}
