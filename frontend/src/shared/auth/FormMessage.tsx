import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import styles from "./AuthForm.module.css";

interface LiveMessageProps {
  /** "alert" for errors, "status" for calm notices. */
  role: "alert" | "status";
  /** null: nothing to say; the live region stays in the page, empty. */
  children: ReactNode | null;
  className?: string;
}

/**
 * The common message of a form, in a live region that exists before its text does, so screen
 * readers announce it. The text fades in (motion); with prefers-reduced-motion it just appears.
 */
export function LiveMessage({ role, children, className }: LiveMessageProps) {
  const reduceMotion = useReducedMotion() ?? false;
  return (
    <div className={styles.live} role={role}>
      <AnimatePresence initial={false}>
        {children !== null && (
          <motion.p
            key="message"
            className={[styles.message, className].filter(Boolean).join(" ")}
            initial={reduceMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
          >
            {children}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

interface FieldErrorProps {
  /** Referenced by aria-describedby of the input. */
  id: string;
  message: string | undefined;
  /** A way out next to the text, e.g. «Зареєструватися» under «Акаунт з такою поштою не знайдено». */
  action?: ReactNode;
}

/** Error under one field. Not a live region: focus moves to the field, which reads it. */
export function FieldError({ id, message, action }: FieldErrorProps) {
  const reduceMotion = useReducedMotion() ?? false;
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.p
          key="error"
          id={id}
          className={styles.fieldError}
          initial={reduceMotion ? false : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.15 }}
        >
          {message}
          {action && <> {action}</>}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

/** aria-describedby from the ids that are present: hint and/or error. */
export function describedBy(
  ...ids: (string | false | undefined)[]
): string | undefined {
  const present = ids.filter(Boolean);
  return present.length > 0 ? present.join(" ") : undefined;
}

/** The submit button: disabled with a spinner while the request runs. */
export function SubmitButton({
  busy,
  disabled = false,
  label,
  busyLabel,
}: {
  busy: boolean;
  /** Inactive without the spinner, e.g. after success while the next page opens. */
  disabled?: boolean;
  label: string;
  busyLabel: string;
}) {
  return (
    <button
      className={styles.submit}
      type="submit"
      disabled={busy || disabled}
      aria-busy={busy || undefined}
    >
      {busy && <span className={styles.spinner} aria-hidden="true" />}
      {busy ? busyLabel : label}
    </button>
  );
}
