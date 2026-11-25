import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router";
import {
  FieldError,
  LiveMessage,
  SubmitButton,
  describedBy,
} from "../../shared/auth/FormMessage";
import { errorMessage } from "../../shared/errors";
import { forgotPasswordTexts as t } from "../../shared/messages.uk";
import {
  forgotPasswordSchemas,
  type ForgotPasswordForm,
} from "../../shared/validation";
import { loginPath, parseResetFor, type LoginTab } from "./loginTabs";
import { useRequestPasswordReset } from "./passwordReset";
import styles from "../../shared/auth/AuthForm.module.css";

/**
 * /forgot-password?for=buyer|brand: «Забули пароль?» from /login. A stub for now: after a valid
 * «Надіслати» the card shows that reset is coming soon; no request goes to the server
 * (useRequestPasswordReset). Same card, fields and green button as /login.
 */
export function ForgotPasswordPage() {
  const [searchParams] = useSearchParams();
  const audience = parseResetFor(searchParams);
  const [sent, setSent] = useState(false);

  return (
    <ForgotPasswordCard
      audience={audience}
      sent={sent}
      onSent={() => setSent(true)}
    />
  );
}

/** The page body: the form before «Надіслати», the stub message after it. */
export function ForgotPasswordCard({
  audience,
  sent,
  onSent,
}: {
  audience: LoginTab;
  sent: boolean;
  onSent: () => void;
}) {
  return (
    <div className={styles.page}>
      <h1 className={`${styles.title} ${styles.titleCentered}`}>{t.title}</h1>
      <div className={styles.card}>
        {/* One live region for the whole card: it exists before «Надіслати», so the stub
            text is announced when it appears. */}
        <div role="status" className={styles.statusRegion}>
          {sent && <p className={styles.sentMessage}>{t.sent}</p>}
        </div>
        {sent ? (
          <PasswordResetSent audience={audience} />
        ) : (
          <ForgotPasswordFormView audience={audience} onSent={onSent} />
        )}
      </div>
    </div>
  );
}

/**
 * After «Надіслати»: the way back to the login tab the user came from. It takes the focus,
 * since the button that had it is gone.
 */
function PasswordResetSent({ audience }: { audience: LoginTab }) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <Link ref={ref} to={loginPath(audience)} className={styles.linkButton}>
      {t.backToLogin}
    </Link>
  );
}

function ForgotPasswordFormView({
  audience,
  onSent,
}: {
  audience: LoginTab;
  onSent: () => void;
}) {
  const requestReset = useRequestPasswordReset();
  const isBuyer = audience === "buyer";
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchemas[audience]),
    defaultValues: { login: "" },
  });

  async function onSubmit({ login }: ForgotPasswordForm) {
    try {
      await requestReset.mutateAsync({ for: audience, login });
      onSent();
    } catch (error) {
      // Only a real request can fail; the entered value stays in the field.
      setError("root", { message: errorMessage(error) });
    }
  }

  const loginError = errors.login?.message;

  return (
    <>
      <p id="forgot-intro" className={styles.intro}>
        {t.intro}
      </p>
      <form
        className={styles.form}
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
        <div className={styles.field}>
          <label htmlFor="forgot-login">
            {isBuyer ? t.buyerLoginLabel : t.emailLabel}
          </label>
          {/* A buyer may type a phone number: type="text" with the email keyboard. */}
          <input
            id="forgot-login"
            type={isBuyer ? "text" : "email"}
            inputMode="email"
            autoComplete={isBuyer ? "username" : "email"}
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={loginError ? true : undefined}
            aria-describedby={describedBy(
              "forgot-intro",
              loginError && "forgot-login-error",
            )}
            {...register("login")}
          />
          <FieldError id="forgot-login-error" message={loginError} />
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
        <Link to={loginPath(audience)}>{t.backToLogin}</Link>
      </p>
    </>
  );
}
