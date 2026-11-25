import { Link, useLocation, useNavigate, useRouteError } from "react-router";
import { routeErrorTexts as t } from "./messages.uk";
import styles from "./RouteError.module.css";

interface RouteErrorViewProps {
  /** The cabinet (/brand/*) leads back to the cabinet, the rest of the site to the home page. */
  area: "site" | "cabinet";
  onRetry: () => void;
  /** Shown small under the buttons, in development only. */
  details: string | null;
}

/** The markup without hooks (the tests read it in node). Use RouteError. */
export function RouteErrorView({
  area,
  onRetry,
  details,
}: RouteErrorViewProps) {
  return (
    <section className={styles.page} aria-labelledby="route-error-title">
      <h1 id="route-error-title" className={styles.title}>
        {t.title}
      </h1>
      <p className={styles.text}>{t.text}</p>
      <div className={styles.actions}>
        <button type="button" onClick={onRetry}>
          {t.retry}
        </button>
        <Link className={styles.back} to={area === "cabinet" ? "/brand" : "/"}>
          {area === "cabinet" ? t.cabinet : t.home}
        </Link>
      </div>
      {details !== null && (
        <details className={styles.details}>
          <summary>{t.details}</summary>
          <pre>{details}</pre>
        </details>
      )}
    </section>
  );
}

/** The error text for developers: never shown to buyers or brands in a production build. */
export function errorDetails(error: unknown, isDev: boolean): string | null {
  if (!isDev) return null;
  if (error instanceof Error)
    return error.stack ?? `${error.name}: ${error.message}`;
  if (typeof error === "object" && error !== null && "status" in error) {
    const { status, statusText } = error as {
      status: unknown;
      statusText?: unknown;
    };
    return `${String(status)} ${typeof statusText === "string" ? statusText : ""}`.trim();
  }
  return String(error);
}

/**
 * errorElement of the routes (App.tsx): one page that crashes shows «Щось пішло не так»
 * instead of a blank site; the header stays. «Спробувати ще раз» navigates to the same
 * address again, which clears the router's error and renders the page anew.
 */
export function RouteError({ area }: { area: "site" | "cabinet" }) {
  const error = useRouteError();
  const navigate = useNavigate();
  const { pathname, search, hash } = useLocation();
  return (
    <RouteErrorView
      area={area}
      onRetry={() =>
        void navigate(`${pathname}${search}${hash}`, { replace: true })
      }
      details={errorDetails(error, import.meta.env.DEV)}
    />
  );
}
