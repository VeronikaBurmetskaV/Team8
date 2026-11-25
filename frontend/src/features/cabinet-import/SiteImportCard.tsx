import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import type {
  BrandProfileResponse,
  ErrorCode,
  ImportStatus,
} from "../../api/types";
import { formatConsentDate } from "../../shared/consentDate";
import { errorCodeOf } from "../../shared/errors";
import { messages, siteImportTexts as t } from "../../shared/messages.uk";
import { brandProductsKey } from "../cabinet-products/queries";
import {
  useImportStatus,
  useSaveFeedUrl,
  useStartImport,
  useVerifySite,
} from "./api";
import {
  formatDateTime,
  formatTime,
  importStep,
  isFeedUrlOnSite,
  isRunning,
  VERIFICATION_FILE_NAME,
  verificationFileText,
  verificationMetaTag,
  verificationRequired,
  waitUntil,
  websiteDomain,
} from "./siteImport";
import styles from "./SiteImportCard.module.css";

type Action = { pending: boolean; error: ErrorCode | null };

export type SiteImportViewProps = {
  profile: BrandProfileResponse;
  status: ImportStatus | null;
  /** From the status (`verificationRequired`); null while it loads. False = demo mode. */
  required: boolean | null;
  /** A moment in ms (the status' fetch time): «next import at …» shows if it is later. */
  now: number;
  verify: Action & { onVerify: () => void };
  start: Action & { onStart: () => void };
  feed: Action & { saved: boolean; onSave: (feedUrl: string | null) => void };
};

/** «Скопіювати мета-тег» with its own short result line. */
function CopyButton({ text }: { text: string }) {
  const [result, setResult] = useState<"copied" | "failed" | null>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setResult("copied");
    } catch {
      setResult("failed");
    }
  }
  return (
    <span className={styles.inlineAction}>
      <button
        type="button"
        className={styles.secondary}
        onClick={() => void copy()}
      >
        {t.copy}
      </button>
      <span role="status" className={styles.small}>
        {result === "copied"
          ? t.copied
          : result === "failed"
            ? t.copyFailed
            : ""}
      </span>
    </span>
  );
}

/** Saves the token as fulla-verification.txt (a Blob URL: nothing is requested). */
function downloadVerificationFile(token: string) {
  const blob = new Blob([verificationFileText(token)], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = VERIFICATION_FILE_NAME;
  link.click();
  URL.revokeObjectURL(url);
}

function VerifyStep({
  domain,
  token,
  verify,
}: {
  domain: string;
  token: string | null;
  verify: SiteImportViewProps["verify"];
}) {
  const headingId = useId();
  return (
    <section className={styles.step} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.stepTitle}>
        {t.stepVerify}
      </h3>
      <p className={styles.text}>{t.verifyIntro(domain)}</p>
      <ol className={styles.methods}>
        {token !== null && (
          <li className={styles.method}>
            <h4 className={styles.methodTitle}>{t.methodMeta}</h4>
            <p className={styles.small}>{t.methodMetaHint}</p>
            <code className={styles.code}>{verificationMetaTag(token)}</code>
            <CopyButton text={verificationMetaTag(token)} />
          </li>
        )}
        {token !== null && (
          <li className={styles.method}>
            <h4 className={styles.methodTitle}>{t.methodFile}</h4>
            <p className={styles.small}>{t.methodFileHint(domain)}</p>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => downloadVerificationFile(token)}
            >
              {t.downloadFile}
            </button>
          </li>
        )}
        <li className={styles.method}>
          <h4 className={styles.methodTitle}>{t.methodEmail}</h4>
          <p className={styles.small}>{t.methodEmailHint(domain)}</p>
        </li>
      </ol>
      <button
        type="button"
        className={styles.primary}
        disabled={verify.pending}
        onClick={verify.onVerify}
      >
        {verify.pending ? t.verifying : t.verify}
      </button>
      {verify.error !== null && (
        <p className={styles.error} role="alert">
          {messages[verify.error]}
        </p>
      )}
    </section>
  );
}

function FeedField({
  profile,
  domain,
  feed,
}: {
  profile: BrandProfileResponse;
  domain: string;
  feed: SiteImportViewProps["feed"];
}) {
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const [value, setValue] = useState(profile.feedUrl ?? "");
  const [touched, setTouched] = useState(false);
  const locallyValid = isFeedUrlOnSite(value, domain);
  const serverInvalid = feed.error === "PROFILE_INVALID";
  const showInvalid = (touched && !locallyValid) || serverInvalid;
  const otherError =
    feed.error !== null && !serverInvalid ? messages[feed.error] : null;

  return (
    <form
      className={styles.feed}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(true);
        if (!locallyValid) return;
        const trimmed = value.trim();
        feed.onSave(trimmed === "" ? null : trimmed);
      }}
    >
      <label htmlFor={inputId} className={styles.label}>
        {t.feedLabel}
      </label>
      <p id={hintId} className={styles.small}>
        {t.feedHint}
      </p>
      <div className={styles.feedRow}>
        <input
          id={inputId}
          type="url"
          inputMode="url"
          placeholder={`https://${domain}/google-feed.xml`}
          value={value}
          aria-invalid={showInvalid ? true : undefined}
          aria-describedby={showInvalid ? `${hintId} ${errorId}` : hintId}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => setTouched(true)}
        />
        <button
          type="submit"
          className={styles.secondary}
          disabled={feed.pending}
        >
          {feed.pending ? t.savingFeed : t.saveFeed}
        </button>
      </div>
      {showInvalid && (
        <p id={errorId} className={styles.error} role="alert">
          {t.feedInvalid(domain)}
        </p>
      )}
      {otherError !== null && (
        <p className={styles.error} role="alert">
          {otherError}
        </p>
      )}
      <p role="status" className={styles.small}>
        {feed.saved && !feed.pending ? t.feedSaved : ""}
      </p>
    </form>
  );
}

/** Progress while running; the summary or the error after (role="status", aria-live). */
function ImportProgress({ status }: { status: ImportStatus | null }) {
  const running = isRunning(status);
  return (
    <div className={styles.progress} role="status" aria-live="polite">
      {running && (
        <>
          <span className={styles.bar} aria-hidden="true" />
          <p className={styles.text}>{t.running}</p>
        </>
      )}
      {status?.status === "DONE" && (
        <>
          <p className={styles.summary}>{t.summary(status)}</p>
          {status.hidden > 0 && (
            <p className={styles.small}>{t.hidden(status.hidden)}</p>
          )}
          <Link
            className={styles.secondaryLink}
            to="/brand/products?filter=imported"
          >
            {t.viewDrafts}
          </Link>
        </>
      )}
      {status?.status === "FAILED" && (
        <p className={styles.error}>
          {t.failed}
          {status.errorCode !== null && `: ${messages[status.errorCode]}`}
        </p>
      )}
    </div>
  );
}

function ImportStep({
  profile,
  domain,
  status,
  now,
  demo,
  start,
  feed,
}: {
  profile: BrandProfileResponse;
  domain: string;
  status: ImportStatus | null;
  now: number;
  /** Demo mode: no ownership check; a grey note instead of «Сайт … підтверджено». */
  demo: boolean;
  start: SiteImportViewProps["start"];
  feed: SiteImportViewProps["feed"];
}) {
  const running = isRunning(status);
  const next = waitUntil(status, now);
  return (
    <>
      {demo && <p className={styles.demoNote}>{t.demoNote}</p>}
      {!demo && profile.siteVerifiedAt && (
        <p className={styles.verified}>
          <span className={styles.check} aria-hidden="true">
            ✓
          </span>
          {t.verifiedOn(domain, formatConsentDate(profile.siteVerifiedAt))}
        </p>
      )}
      <FeedField profile={profile} domain={domain} feed={feed} />
      <div className={styles.importRow}>
        <button
          type="button"
          className={styles.primary}
          disabled={running || start.pending}
          onClick={start.onStart}
        >
          {start.pending ? t.importStarting : t.importFrom(domain)}
        </button>
        {next !== null && (
          <p className={styles.small}>{t.nextAllowed(formatTime(next))}</p>
        )}
      </div>
      {start.error !== null && (
        <p className={styles.error} role="alert">
          {messages[start.error]}
        </p>
      )}
      <ImportProgress status={status} />
      {status?.lastSuccessAt && (
        <p className={styles.small}>
          {t.lastImport(formatDateTime(status.lastSuccessAt))}
        </p>
      )}
      <p className={styles.small}>{t.autoRefresh}</p>
    </>
  );
}

/** «Імпорт з сайту» (ADR-0017), every state from props: rendered as is by the tests. */
export function SiteImportView({
  profile,
  status,
  required,
  now,
  verify,
  start,
  feed,
}: SiteImportViewProps) {
  const titleId = useId();
  const step = importStep(profile, required);
  const demo = required === false;
  // In demo mode the import reads the website's domain; otherwise the verified one.
  const domain =
    (demo ? null : profile.siteDomain) ??
    websiteDomain(profile.websiteUrl) ??
    "";
  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>
        {t.title}
      </h2>
      <p className={styles.text}>{t.intro}</p>
      {step === "no-website" && (
        <p className={styles.text}>
          <Link to="/brand/profile">{t.addWebsite}</Link>
        </p>
      )}
      {step === "loading" && <p className={styles.small}>{t.loading}</p>}
      {step === "verify" && (
        <VerifyStep
          domain={domain}
          token={profile.verificationToken || null}
          verify={verify}
        />
      )}
      {step === "ready" && (
        <ImportStep
          profile={profile}
          domain={domain}
          status={status}
          now={now}
          demo={demo}
          start={start}
          feed={feed}
        />
      )}
    </section>
  );
}

function errorOf(error: unknown): ErrorCode | null {
  return error === null || error === undefined ? null : errorCodeOf(error);
}

/** The card on /brand: queries, mutations and the polling around {@link SiteImportView}. */
export function SiteImportCard({ profile }: { profile: BrandProfileResponse }) {
  // The status also says whether the ownership check is required (demo mode), so it is
  // loaded as soon as there is a website.
  const statusQuery = useImportStatus(Boolean(profile.websiteUrl));
  const startImport = useStartImport();
  const verifySite = useVerifySite();
  const saveFeed = useSaveFeedUrl();
  const queryClient = useQueryClient();
  const status = statusQuery.data ?? null;
  const required = verificationRequired(
    statusQuery.data,
    statusQuery.isPending && statusQuery.fetchStatus !== "idle",
  );

  // When a run ends, the product list has new drafts: reload it once.
  const wasRunning = useRef(false);
  const running = isRunning(status);
  useEffect(() => {
    if (wasRunning.current && !running) {
      void queryClient.invalidateQueries({ queryKey: brandProductsKey });
    }
    wasRunning.current = running;
  }, [running, queryClient]);

  return (
    <SiteImportView
      profile={profile}
      status={status}
      required={required}
      // When the status was read: «next import at …» is shown if that time was still ahead.
      now={statusQuery.dataUpdatedAt}
      verify={{
        pending: verifySite.isPending,
        error: errorOf(verifySite.error),
        onVerify: () => verifySite.mutate(),
      }}
      start={{
        pending: startImport.isPending,
        error: errorOf(startImport.error),
        onStart: () => startImport.mutate(),
      }}
      feed={{
        pending: saveFeed.isPending,
        error: errorOf(saveFeed.error),
        saved: saveFeed.isSuccess,
        onSave: (feedUrl) => saveFeed.mutate({ profile, feedUrl }),
      }}
    />
  );
}
