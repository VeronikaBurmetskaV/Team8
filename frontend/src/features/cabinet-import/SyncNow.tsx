import { Link } from "react-router";
import type {
  BrandProfileResponse,
  ErrorCode,
  ImportStatus,
} from "../../api/types";
import { errorCodeOf } from "../../shared/errors";
import { messages, siteImportTexts as t } from "../../shared/messages.uk";
import {
  useClockUntil,
  useImportStatus,
  useReloadProductsAfterRun,
  useStartImport,
} from "./api";
import {
  formatSyncedAt,
  formatTime,
  importStep,
  isRunning,
  lastSyncedAt,
  verificationRequired,
  waitUntil,
} from "./siteImport";
import styles from "./SyncNow.module.css";

export type SyncNowViewProps = {
  status: ImportStatus | null;
  /** «Now» (ms, useClockUntil): «сьогодні / вчора» and the rate limit use it. */
  now: number;
  pending: boolean;
  error: ErrorCode | null;
  onSync: () => void;
};

/**
 * «Оновити з сайту» and, under it on its left edge, «Оновлено: сьогодні о 18:52» or
 * «Оновлюємо…» with a spinner (ADR-0017). The same import as the first one, with the same limit
 * (one per 10 minutes): while it lasts the button is disabled and only its hint (title, and a
 * hidden description for screen readers) says «Оновити знову можна о 23:57» — no extra line.
 */
export function SyncNowView({
  status,
  now,
  pending,
  error,
  onSync,
}: SyncNowViewProps) {
  const busy = isRunning(status) || pending;
  const synced = lastSyncedAt(status);
  const blockedUntil = busy ? null : waitUntil(status, now);
  const hint =
    blockedUntil === null ? undefined : t.syncAgainAt(formatTime(blockedUntil));
  return (
    <div className={styles.sync}>
      {/* The title is on the wrapper too: some browsers show none on a disabled button. */}
      <span className={styles.buttonBox} title={hint}>
        <button
          type="button"
          className={styles.button}
          disabled={busy || blockedUntil !== null}
          aria-busy={busy || undefined}
          aria-describedby={
            hint === undefined ? "sync-status" : "sync-status sync-wait"
          }
          title={hint}
          onClick={onSync}
        >
          {t.syncNow}
        </button>
        {hint !== undefined && (
          <span id="sync-wait" className={styles.visuallyHidden}>
            {hint}
          </span>
        )}
      </span>
      <p id="sync-status" role="status" className={styles.note}>
        {busy ? (
          <>
            <span className={styles.spinner} aria-hidden="true" />
            {t.syncing}
          </>
        ) : synced !== null ? (
          t.syncedAt(formatSyncedAt(synced, now))
        ) : (
          t.neverSynced
        )}
      </p>
      {status?.status === "FAILED" && !busy && (
        <p className={styles.error}>
          {t.syncFailed}
          {status.errorCode !== null && `: ${messages[status.errorCode]}`}
        </p>
      )}
      {error !== null && (
        <p className={styles.error} role="alert">
          {messages[error]}
        </p>
      )}
    </div>
  );
}

/**
 * The sync slot of /brand/products: the button when an import is possible; without a website
 * «Додайте сайт бренду в профілі»; with a website that still needs the ownership check, the way
 * to it on /brand. Nothing while the status loads.
 */
export function SyncNow({ profile }: { profile: BrandProfileResponse }) {
  const statusQuery = useImportStatus(Boolean(profile.websiteUrl));
  const start = useStartImport();
  const status = statusQuery.data ?? null;
  const now = useClockUntil(status?.nextAllowedAt);
  useReloadProductsAfterRun(status);
  const required = verificationRequired(
    statusQuery.data,
    statusQuery.isPending && statusQuery.fetchStatus !== "idle",
  );
  const step = importStep(profile, required);
  if (step === "loading") return null;
  if (step === "no-website" || step === "verify") {
    return (
      <p className={styles.hint}>
        {step === "no-website" ? (
          <Link to="/brand/profile">{t.addWebsite}</Link>
        ) : (
          <Link to="/brand">{t.verifyFirst}</Link>
        )}
      </p>
    );
  }
  return (
    <SyncNowView
      status={status}
      now={now}
      pending={start.isPending}
      error={
        start.error === null || start.error === undefined
          ? null
          : errorCodeOf(start.error)
      }
      onSync={() => start.mutate()}
    />
  );
}
