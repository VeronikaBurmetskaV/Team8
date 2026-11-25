import { useId, useState } from "react";
import { Link, useSearchParams } from "react-router";
import type {
  BrandCard,
  BulkPublishResponse,
  ErrorCode,
  ProfileState,
} from "../../api/types";
import { useBrandProfile } from "../../shared/brandProfile";
import { errorCodeOf } from "../../shared/errors";
import {
  brandProductsTexts as t,
  messages,
  publishTexts,
} from "../../shared/messages.uk";
import { AddProductEntry } from "./AddProductEntry";
import { LoadError } from "./LoadError";
import {
  draftIds,
  filterCards,
  filterParam,
  isImported,
  parseFilter,
  selectedDrafts,
  toggle,
  toggleAll,
  type ProductFilter,
} from "./productList";
import { publishGate } from "./publishGate";
import {
  useBrandProducts,
  usePublishBrandProduct,
  usePublishBrandProducts,
  usePublishingIds,
} from "./queries";
import styles from "./BrandProductsPage.module.css";

const statusText: Record<BrandCard["status"], string> = {
  DRAFT: "Чернетка",
  PUBLISHED: "Опубліковано",
};

/** Only the two photo sources of the contract ever reach `src`. */
function isSafePhotoUrl(url: string): boolean {
  return url.startsWith("/api/images/") || url.startsWith("https://");
}

function Thumbnail({ card }: { card: BrandCard }) {
  const [failed, setFailed] = useState(false);
  if (failed || !isSafePhotoUrl(card.photoUrl)) {
    return <span className={styles.placeholder}>Фото недоступне</span>;
  }
  return (
    <img
      className={styles.thumbnail}
      src={card.photoUrl}
      alt={card.name}
      onError={() => setFailed(true)}
    />
  );
}

/** One per page: the publish buttons point to it with aria-describedby. */
const consentHintId = "publish-consent-hint";

/**
 * The text of a failed publish (one card or many), or null when the page already explains it.
 * UNAUTHENTICATED: the client is redirecting to the login page. INVALID_STATE: no text in the
 * contract, the refetched list shows the real status. CONSENT_REQUIRED: the hint above the
 * list already says it.
 */
function publishErrorText(code: ErrorCode, hintShown: boolean): string | null {
  if (code === "UNAUTHENTICATED" || code === "INVALID_STATE") return null;
  if (code === "CONSENT_REQUIRED" && hintShown) return null;
  return messages[code];
}

/** The result of the last bulk publish, or its error. */
export type PublishOutcome =
  | { kind: "done"; result: BulkPublishResponse }
  | { kind: "error"; code: ErrorCode }
  | null;

type ViewProps = {
  cards: readonly BrandCard[];
  filter: ProductFilter;
  onFilter: (filter: ProductFilter) => void;
  selected: ReadonlySet<string>;
  onSelect: (selected: Set<string>) => void;
  /** null while the profile loads. Publishing needs CONSENTED (T-1, US-22.2). */
  profileState: ProfileState | null;
  /** A bulk publish is running. */
  publishing: boolean;
  onPublish: (ids: string[]) => void;
  outcome: PublishOutcome;
  /** IDs of the cards whose single publish is still running. */
  publishingIds: readonly string[];
  onPublishOne: (id: string) => void;
  /** The last failed single publish per card, shown in its row until the next try. */
  rowErrors: Readonly<Record<string, ErrorCode>>;
};

/**
 * The list with the filter, the checkboxes, the bulk publish bar (ADR-0017) and the publish
 * button of each draft (US-31). Presentational: the page keeps the state, so tests can render
 * every state directly. All buttons are UX only: the server is the gate (ADR-0009).
 */
export function ProductsListView({
  cards,
  filter,
  onFilter,
  selected,
  onSelect,
  profileState,
  publishing,
  onPublish,
  outcome,
  publishingIds,
  onPublishOne,
  rowErrors,
}: ViewProps) {
  const filterId = useId();
  const shown = filterCards(cards, filter);
  const shownDrafts = draftIds(shown);
  const toPublish = selectedDrafts(selected, shownDrafts);
  const allSelected =
    shownDrafts.length > 0 && shownDrafts.every((id) => selected.has(id));
  const consented = profileState === "CONSENTED";
  const showConsentHint = cards.some(
    (card) => publishGate(card, profileState).kind === "consentRequired",
  );
  const bulkBlocked = !consented || publishing;
  const describedBy = showConsentHint ? consentHintId : undefined;
  const outcomeError =
    outcome?.kind === "error"
      ? publishErrorText(outcome.code, showConsentHint)
      : null;

  return (
    <>
      <div className={styles.toolbar}>
        <label className={styles.filter} htmlFor={filterId}>
          {t.filterLabel}
          <select
            id={filterId}
            value={filter}
            onChange={(event) => onFilter(event.target.value as ProductFilter)}
          >
            <option value="all">{t.filterAll}</option>
            <option value="imported-drafts">{t.filterImportedDrafts}</option>
          </select>
        </label>

        <div className={styles.publishBar}>
          <button
            type="button"
            className={styles.publishButton}
            disabled={bulkBlocked || toPublish.length === 0}
            aria-describedby={describedBy}
            onClick={() => onPublish(toPublish)}
          >
            {publishing ? t.publishing : t.publishSelected(toPublish.length)}
          </button>
          <button
            type="button"
            className={styles.publishAllButton}
            disabled={bulkBlocked || shownDrafts.length === 0}
            aria-describedby={describedBy}
            onClick={() => onPublish(shownDrafts)}
          >
            {t.publishAll(shownDrafts.length)}
          </button>
        </div>
      </div>

      {showConsentHint && (
        <p id={consentHintId} className={styles.consentHint}>
          {messages.CONSENT_REQUIRED}{" "}
          <Link to="/brand/profile#consent">{t.consentLink}</Link>
        </p>
      )}

      <div role="status" aria-live="polite" className={styles.outcome}>
        {outcome?.kind === "done" && (
          <>
            <span>{t.published(outcome.result.publishedIds.length)}</span>
            {outcome.result.skippedIds.length > 0 && (
              <span> {t.skipped(outcome.result.skippedIds.length)}</span>
            )}
          </>
        )}
      </div>
      {outcome?.kind === "error" && outcomeError !== null && (
        <p className={styles.publishError} role="alert">
          {outcomeError}
          {outcome.code === "CONSENT_REQUIRED" && (
            <>
              {" "}
              <Link to="/brand/profile#consent">{t.consentLink}</Link>
            </>
          )}
        </p>
      )}

      {shown.length === 0 ? (
        <p className={styles.empty}>
          {filter === "all" ? "У вас поки немає товарів" : t.emptyFilter}
        </p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className={styles.selectCell}>
                <input
                  type="checkbox"
                  aria-label={t.selectAll}
                  checked={allSelected}
                  disabled={shownDrafts.length === 0}
                  onChange={() => onSelect(toggleAll(selected, shownDrafts))}
                />
              </th>
              <th scope="col">Фото</th>
              <th scope="col">Назва</th>
              <th scope="col">Ціна</th>
              <th scope="col">Статус</th>
              <th scope="col">{publishTexts.actions}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((card) => {
              const gate = publishGate(card, profileState);
              const busy = publishingIds.includes(card.id);
              const rowCode = rowErrors[card.id];
              const rowError =
                rowCode === undefined
                  ? null
                  : publishErrorText(rowCode, showConsentHint);
              return (
                <tr key={card.id}>
                  <td className={styles.selectCell}>
                    {card.status === "DRAFT" && (
                      <input
                        type="checkbox"
                        aria-label={t.select(card.name)}
                        checked={selected.has(card.id)}
                        onChange={() => onSelect(toggle(selected, card.id))}
                      />
                    )}
                  </td>
                  <td className={styles.photo}>
                    <Thumbnail card={card} />
                  </td>
                  <td className={styles.name}>
                    {card.name}
                    {isImported(card) && (
                      <span className={styles.badge}>{t.fromSite}</span>
                    )}
                    {(card.editedFields?.length ?? 0) > 0 && (
                      <span className={styles.editedBadge}>
                        {t.editedByHand}
                      </span>
                    )}
                  </td>
                  <td className={styles.price}>{card.priceUah} грн</td>
                  <td className={styles.status}>{statusText[card.status]}</td>
                  <td className={styles.actions}>
                    {gate.kind !== "hidden" && (
                      <div className={styles.rowActions}>
                        <Link
                          to={`/brand/products/${card.id}`}
                          aria-label={t.edit(card.name)}
                        >
                          {t.editShort}
                        </Link>
                        <button
                          type="button"
                          className={styles.publish}
                          disabled={gate.kind !== "ready" || busy || publishing}
                          aria-busy={busy || undefined}
                          aria-describedby={
                            gate.kind === "consentRequired"
                              ? consentHintId
                              : undefined
                          }
                          onClick={() => onPublishOne(card.id)}
                        >
                          {publishTexts.publish}
                        </button>
                      </div>
                    )}
                    {rowError !== null && (
                      <p className={styles.publishError} role="alert">
                        {rowError}
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

export function BrandProductsPage() {
  const products = useBrandProducts();
  const profile = useBrandProfile();
  const publishMany = usePublishBrandProducts();
  const publishOne = usePublishBrandProduct();
  const publishingIds = usePublishingIds();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [outcome, setOutcome] = useState<PublishOutcome>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, ErrorCode>>({});
  const filter = parseFilter(searchParams.get("filter"));
  const profileState = profile.data?.state ?? null;

  function changeFilter(next: ProductFilter) {
    const param = filterParam(next);
    setSearchParams(param === null ? {} : { filter: param });
  }

  function setRowError(id: string, code: ErrorCode | undefined) {
    setRowErrors((errors) => {
      const next = { ...errors };
      if (code === undefined) delete next[id];
      else next[id] = code;
      return next;
    });
  }

  function publishIds(ids: string[]) {
    setOutcome(null);
    publishMany.mutate(ids, {
      onSuccess: (result) => {
        setOutcome({ kind: "done", result });
        setSelected(new Set());
      },
      onError: (error) =>
        setOutcome({ kind: "error", code: errorCodeOf(error) }),
    });
  }

  function publishId(id: string) {
    setOutcome(null);
    setRowError(id, undefined);
    // A published card drops out of the selection by itself: selectedDrafts() keeps drafts only.
    publishOne.mutate(id, {
      onError: (error) => setRowError(id, errorCodeOf(error)),
    });
  }

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t.title}</h1>
        <AddProductEntry profileState={profileState} size="medium" />
      </div>

      {products.isPending && <p>Завантаження…</p>}

      {products.isError && (
        <LoadError
          error={products.error}
          onRetry={() => void products.refetch()}
        />
      )}

      {products.isSuccess && products.data.length === 0 && (
        <p className={styles.empty}>У вас поки немає товарів</p>
      )}

      {products.isSuccess && products.data.length > 0 && (
        <ProductsListView
          cards={products.data}
          filter={filter}
          onFilter={changeFilter}
          selected={selected}
          onSelect={setSelected}
          profileState={profileState}
          publishing={publishMany.isPending}
          onPublish={publishIds}
          outcome={outcome}
          publishingIds={publishingIds}
          onPublishOne={publishId}
          rowErrors={rowErrors}
        />
      )}
    </section>
  );
}
