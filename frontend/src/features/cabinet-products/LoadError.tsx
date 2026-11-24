import { errorCodeOf } from "../../shared/errors";
import { cabinetHomeTexts as t, messages } from "../../shared/messages.uk";
import styles from "./LoadError.module.css";

/** A failed cabinet query: the error text and «Спробувати ще раз». */
export function LoadError({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  const code = errorCodeOf(error);
  // No session: the API client is already redirecting to /login?tab=brand (US-21.1 CL).
  if (code === "UNAUTHENTICATED") return null;
  return (
    <div className={styles.loadError} role="alert">
      <p>{messages[code]}</p>
      <button type="button" onClick={onRetry}>
        {t.retry}
      </button>
    </div>
  );
}
