import { useEffect, useState } from "react";
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
import { buyerAuthTexts as t } from "../../shared/messages.uk";
import {
  PASSWORD_MIN,
  buyerRegisterSchema,
  type BuyerRegisterForm,
} from "../../shared/validation";
import { submitRegistration, useRegisterBuyer } from "./api";
import styles from "../../shared/auth/AuthForm.module.css";

/** How long «Акаунт створено» stays before the home page opens. */
const SUCCESS_DELAY_MS = 1200;

/**
 * /register: buyer registration (US-02). Optional for the buyer and never in front of the
 * feed (BR-03): it is reached from «Вподобане», the navigation and /login.
 */
export function BuyerRegisterPage() {
  const navigate = useNavigate();
  const registerBuyer = useRegisterBuyer();
  const [nextPath, setNextPath] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BuyerRegisterForm>({
    resolver: zodResolver(buyerRegisterSchema),
    defaultValues: { name: "", login: "", password: "", confirmPassword: "" },
  });

  // «Акаунт створено» stays on screen for a moment, then the home page opens.
  useEffect(() => {
    if (nextPath === null) return;
    const timer = setTimeout(() => navigate(nextPath), SUCCESS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [nextPath, navigate]);

  async function onSubmit({ name, login, password }: BuyerRegisterForm) {
    const outcome = await submitRegistration(
      { name, login, password },
      registerBuyer.mutateAsync,
    );
    if (outcome.ok) {
      setNextPath(outcome.next);
      return;
    }
    // The entered data stays in the form (US-02 S2); focus goes to the first wrong field.
    const { form, ...byField } = outcome.errors;
    const order = ["name", "login", "password"] as const;
    const first = order.find((field) => byField[field] !== undefined);
    for (const field of order) {
      const message = byField[field];
      if (message !== undefined) {
        setError(field, { message }, { shouldFocus: field === first });
      }
    }
    if (form) setError("root", { message: form });
  }

  const nameError = errors.name?.message;
  const loginError = errors.login?.message;
  const passwordError = errors.password?.message;
  const confirmError = errors.confirmPassword?.message;
  const created = nextPath !== null;

  return (
    <div className={styles.page}>
      <h1 className={`${styles.title} ${styles.titleCentered}`}>
        {t.registerTitle}
      </h1>
      <div className={styles.card}>
        <form
          className={styles.form}
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <div className={styles.field}>
            <label htmlFor="register-name">{t.nameLabel}</label>
            <input
              id="register-name"
              type="text"
              autoComplete="given-name"
              aria-invalid={nameError ? true : undefined}
              aria-describedby={describedBy(nameError && "register-name-error")}
              {...register("name")}
            />
            <FieldError id="register-name-error" message={nameError} />
          </div>
          <div className={styles.field}>
            <label htmlFor="register-login">{t.loginLabel}</label>
            {/* Email or phone in one field: type="text" (a phone is not an email), email keyboard. */}
            <input
              id="register-login"
              type="text"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={loginError ? true : undefined}
              aria-describedby={describedBy(
                loginError && "register-login-error",
              )}
              {...register("login")}
            />
            <FieldError id="register-login-error" message={loginError} />
          </div>
          <div className={styles.field}>
            <label htmlFor="register-password">{t.password}</label>
            <PasswordInput
              id="register-password"
              autoComplete="new-password"
              aria-invalid={passwordError ? true : undefined}
              aria-describedby={describedBy(
                "register-password-hint",
                passwordError && "register-password-error",
              )}
              {...register("password")}
            />
            <p id="register-password-hint" className={styles.hint}>
              {t.passwordHint(PASSWORD_MIN)}
            </p>
            <FieldError id="register-password-error" message={passwordError} />
          </div>
          <div className={styles.field}>
            <label htmlFor="register-confirm">{t.confirmPassword}</label>
            <PasswordInput
              id="register-confirm"
              autoComplete="new-password"
              aria-invalid={confirmError ? true : undefined}
              aria-describedby={describedBy(
                confirmError && "register-confirm-error",
              )}
              {...register("confirmPassword")}
            />
            <FieldError id="register-confirm-error" message={confirmError} />
          </div>
          <div className={styles.actions}>
            <SubmitButton
              busy={isSubmitting}
              disabled={created}
              label={t.createAccount}
              busyLabel={t.creatingAccount}
            />
            <LiveMessage role="alert" className={styles.error}>
              {errors.root?.message ?? null}
            </LiveMessage>
            <LiveMessage role="status" className={styles.success}>
              {created ? t.accountCreated : null}
            </LiveMessage>
          </div>
        </form>
        <p className={styles.note}>{t.privacyNote}</p>
        <p className={styles.footer}>
          {t.haveAccount} <Link to="/login">{t.toLogin}</Link>
        </p>
      </div>
    </div>
  );
}
