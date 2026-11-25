import { useEffect, useState, type MouseEvent } from "react";
import { Link } from "react-router";
import type {
  BrandCard,
  BulkPublishResponse,
  BulkUnpublishResponse,
  ErrorCode,
  ProfileState,
} from "../../api/types";
import { useBrandProfile } from "../../shared/brandProfile";
import { ConfirmDialog } from "../../shared/ConfirmDialog";
import { errorCodeOf } from "../../shared/errors";
import {
  brandProductsTexts as t,
  confirmTexts,
  messages,
  publishTexts,
} from "../../shared/messages.uk";
import { productsTitle, productsDocumentTitle } from "./productsTitle";
import { SyncNow } from "../cabinet-import/SyncNow";
import { AddProductEntry } from "./AddProductEntry";
import { LoadError } from "./LoadError";
import {
  answerUnpublish,
  displayStatus,
  draftIds,
  listOrder,
  isNotOnSite,
  isSelectable,
  rowClickToggles,
  selectableIds,
  selectedDrafts,
  selectedPublished,
  splitNotOnSite,
  toggle,
  toggleAll,
  type DisplayStatus,
  type UnpublishRequest,
} from "./productList";
import { publishGate } from "./publishGate";
import {
  useBrandProducts,
  useRemoveFromList,
  useRemovingIds,
  usePublishBrandProduct,
  usePublishBrandProducts,
  usePublishingIds,
  useUnpublishBrandProduct,
  useUnpublishBrandProducts,
  useUnpublishingIds,
} from "./queries";
import styles from "./BrandProductsPage.module.css";

const statusText: Record<DisplayStatus, string> = {
  DRAFT: t.statusDraft,
  PUBLISHED: t.statusPublished,
  NOT_ON_SITE: t.statusNotOnSite,
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
/** The «Цього товару більше немає на сайті бренду» line of a row. */
const notOnSiteHintId = (id: string) => `not-on-site-${id}`;

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

/**
 * The result of the last bulk publish, or its error. `notOnSite`: selected «Немає на сайті»
 * cards that were skipped without a request.
 */
export type PublishOutcome =
  | { kind: "done"; result: BulkPublishResponse; notOnSite: number }
  | { kind: "unpublished"; result: BulkUnpublishResponse }
  | { kind: "error"; code: ErrorCode }
  | null;

type ViewProps = {
  cards: readonly BrandCard[];
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
  /** «Прибрати зі списку» of a «Немає на сайті» card (ADR-0017). */
  onRemoveFromList?: (id: string) => void;
  removingIds?: readonly string[];
  /** «Зняти з публікації» (one row) or «Зняти вибрані з публікації»: asks first. */
  onUnpublish?: (request: NonNullable<UnpublishRequest>) => void;
  /** The open confirmation, or null. */
  confirming?: UnpublishRequest;
  /** «Зняти» (true) or «Скасувати» / Esc / backdrop (false). */
  onAnswerUnpublish?: (confirmed: boolean) => void;
  /** IDs of the cards whose single unpublish is still running. */
  unpublishingIds?: readonly string[];
  /** «Зняти вибрані з публікації» is running. */
  unpublishingMany?: boolean;
};

/**
 * The list with its count, the round selection circles, the bulk bar (ADR-0017) and, on the
 * right of each row, its main action — «Опублікувати у стрічку» for a draft, «Зняти з
 * публікації» for a published card (US-31) — with «Редагувати» under it. A row is large: the
 * 3:4 photo, the name, and under it the price and the status. «Немає на сайті» rows come last,
 * muted, without a circle and without publishing. Presentational: the page keeps the state, so tests can render every state
 * directly. All buttons are UX only: the server is the gate (ADR-0009).
 */
export function ProductsListView({
  cards,
  selected,
  onSelect,
  profileState,
  publishing,
  onPublish,
  outcome,
  publishingIds,
  onPublishOne,
  rowErrors,
  onRemoveFromList = () => undefined,
  removingIds = [],
  onUnpublish = () => undefined,
  confirming = null,
  onAnswerUnpublish = () => undefined,
  unpublishingIds = [],
  unpublishingMany = false,
}: ViewProps) {
  const shown = listOrder(cards);
  const shownDrafts = draftIds(shown);
  const shownSelectable = selectableIds(shown);
  const toPublish = selectedDrafts(selected, shown);
  const toUnpublish = selectedPublished(selected, shown);
  const allSelected =
    shownSelectable.length > 0 &&
    shownSelectable.every((id) => selected.has(id));
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

  function onRowClick(card: BrandCard, event: MouseEvent<HTMLElement>) {
    if (!isSelectable(card) || !rowClickToggles(event.target as Element)) {
      return;
    }
    onSelect(toggle(selected, card.id));
  }

  return (
    <>
      <div className={styles.toolbar}>
        <p className={styles.count}>{t.count(shown.length)}</p>

        {/* «Опублікувати всі чернетки» on the left, «Опублікувати вибрані» on the right; with
            published cards among the selected ones also «Зняти вибрані з публікації». */}
        <div className={styles.publishBar}>
          <button
            type="button"
            className={styles.publishAllButton}
            disabled={bulkBlocked || shownDrafts.length === 0}
            aria-describedby={describedBy}
            onClick={() => onPublish(shownDrafts)}
          >
            {t.publishAll(shownDrafts.length)}
          </button>
          <button
            type="button"
            className={styles.publishButton}
            disabled={bulkBlocked || toPublish.length === 0}
            aria-describedby={describedBy}
            onClick={() => onPublish(toPublish)}
          >
            {publishing ? t.publishing : t.publishSelected(toPublish.length)}
          </button>
          {toUnpublish.length > 0 && (
            <button
              type="button"
              className={styles.unpublish}
              disabled={unpublishingMany}
              aria-busy={unpublishingMany || undefined}
              onClick={() => onUnpublish({ ids: toUnpublish, bulk: true })}
            >
              {unpublishingMany
                ? t.unpublishing
                : t.unpublishSelected(toUnpublish.length)}
            </button>
          )}
        </div>
      </div>

      {showConsentHint && (
        <p id={consentHintId} className={styles.consentHint}>
          {messages.CONSENT_REQUIRED}{" "}
          <Link to="/brand/profile#consent">{t.consentLink}</Link>
        </p>
      )}

      <div role="status" aria-live="polite" className={styles.outcome}>
        {outcome?.kind === "unpublished" && (
          <>
            <span>{t.unpublished(outcome.result.unpublishedIds.length)}</span>
            {outcome.result.skippedIds.length > 0 && (
              <span> {t.skipped(outcome.result.skippedIds.length)}</span>
            )}
          </>
        )}
        {outcome?.kind === "done" && (
          <>
            {(outcome.result.publishedIds.length > 0 ||
              outcome.notOnSite === 0) && (
              <span>{t.published(outcome.result.publishedIds.length)}</span>
            )}
            {outcome.result.skippedIds.length > 0 && (
              <span> {t.skipped(outcome.result.skippedIds.length)}</span>
            )}
            {outcome.notOnSite > 0 && (
              <span className={styles.outcomeWarning}>
                {" "}
                {t.skippedNotOnSite(outcome.notOnSite)}
              </span>
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
        <p className={styles.empty}>{t.empty}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className={styles.selectCell}>
                <input
                  type="checkbox"
                  className={styles.selector}
                  aria-label={t.selectAll}
                  checked={allSelected}
                  disabled={shownSelectable.length === 0}
                  onChange={() =>
                    onSelect(toggleAll(selected, shownSelectable))
                  }
                />
              </th>
              <th scope="col">Фото</th>
              <th scope="col">Товар</th>
              <th scope="col">{publishTexts.actions}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((card) => {
              const gate = publishGate(card, profileState);
              const busy =
                publishingIds.includes(card.id) ||
                unpublishingIds.includes(card.id);
              const removing = removingIds.includes(card.id);
              const notOnSite = isNotOnSite(card);
              const selectable = isSelectable(card);
              const isSelected = selectable && selected.has(card.id);
              const hintId = notOnSite ? notOnSiteHintId(card.id) : undefined;
              const rowCode = rowErrors[card.id];
              const rowError =
                rowCode === undefined
                  ? null
                  : publishErrorText(rowCode, showConsentHint);
              const rowClass = [
                styles.row,
                selectable ? styles.selectable : "",
                isSelected ? styles.selected : "",
                notOnSite ? styles.notOnSite : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <tr
                  key={card.id}
                  className={rowClass}
                  onClick={(event) => onRowClick(card, event)}
                >
                  <td className={styles.selectCell}>
                    {selectable && (
                      <input
                        type="checkbox"
                        className={styles.selector}
                        aria-label={t.select(card.name)}
                        checked={isSelected}
                        onChange={() => onSelect(toggle(selected, card.id))}
                      />
                    )}
                  </td>
                  <td className={styles.photo}>
                    <Thumbnail card={card} />
                  </td>
                  <td className={styles.info}>
                    <p className={styles.name}>{card.name}</p>
                    <p className={styles.meta}>
                      <span
                        className={styles.price}
                      >{`${card.priceUah} грн`}</span>
                      <span
                        className={[
                          styles.status,
                          styles[`status${displayStatus(card)}`] ?? "",
                        ].join(" ")}
                      >
                        {statusText[displayStatus(card)]}
                      </span>
                    </p>
                    {notOnSite && (
                      <p id={hintId} className={styles.notOnSiteHint}>
                        {t.notOnSiteHint}
                      </p>
                    )}
                  </td>
                  <td className={styles.actions}>
                    {/* The main action on top, «Редагувати» under it. */}
                    <div className={styles.rowActions}>
                      {card.status === "PUBLISHED" && (
                        <button
                          type="button"
                          className={styles.unpublish}
                          disabled={busy || unpublishingMany}
                          aria-busy={busy || undefined}
                          onClick={() =>
                            onUnpublish({ ids: [card.id], bulk: false })
                          }
                        >
                          {t.unpublish}
                        </button>
                      )}
                      {card.status === "DRAFT" && !notOnSite && (
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
                      )}
                      {notOnSite && (
                        <button
                          type="button"
                          className={styles.remove}
                          disabled={removing}
                          aria-busy={removing || undefined}
                          aria-label={t.removeFromListOf(card.name)}
                          onClick={() => onRemoveFromList(card.id)}
                        >
                          {removing ? t.removing : t.removeFromList}
                        </button>
                      )}
                      <Link
                        className={styles.edit}
                        to={`/brand/products/${card.id}`}
                        aria-label={t.edit(card.name)}
                      >
                        {t.editShort}
                      </Link>
                    </div>
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

      <ConfirmDialog
        open={confirming !== null}
        title={t.unpublishQuestion}
        confirmLabel={t.unpublishConfirm}
        cancelLabel={confirmTexts.cancel}
        onConfirm={() => onAnswerUnpublish(true)}
        onCancel={() => onAnswerUnpublish(false)}
      />
    </>
  );
}

/**
 * «Товари бренду BEVZA (demo)»: the brand name from the profile in the same heading, in green;
 * it wraps under «Товари бренду» on a narrow screen. Without a name (loading, or none saved)
 * just «Товари бренду».
 */
export function ProductsTitle({ brandName }: { brandName: string | null }) {
  const { title, brand } = productsTitle(brandName);
  return (
    <h1 className={styles.title}>
      {brand === null ? title : `${title} `}
      {brand !== null && <span className={styles.brandName}>{brand}</span>}
    </h1>
  );
}

export function BrandProductsPage() {
  const products = useBrandProducts();
  const profile = useBrandProfile();
  const publishMany = usePublishBrandProducts();
  const publishOne = usePublishBrandProduct();
  const publishingIds = usePublishingIds();
  const removeFromList = useRemoveFromList();
  const removingIds = useRemovingIds();
  const unpublishOne = useUnpublishBrandProduct();
  const unpublishMany = useUnpublishBrandProducts();
  const unpublishingIds = useUnpublishingIds();
  const [confirming, setConfirming] = useState<UnpublishRequest>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [outcome, setOutcome] = useState<PublishOutcome>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, ErrorCode>>({});
  const profileState = profile.data?.state ?? null;
  const brandName = profile.data?.name ?? null;

  // «Товари BEVZA — FULLA»; the previous title comes back when the page closes.
  useEffect(() => {
    const previous = document.title;
    document.title = productsDocumentTitle(brandName);
    return () => {
      document.title = previous;
    };
  }, [brandName]);

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
    // «Немає на сайті» cards are skipped with a message, without a request (ADR-0017).
    const { publish, notOnSite } = splitNotOnSite(ids, products.data ?? []);
    if (publish.length === 0) {
      setOutcome({
        kind: "done",
        result: { publishedIds: [], skippedIds: [] },
        notOnSite: notOnSite.length,
      });
      setSelected(new Set());
      return;
    }
    publishMany.mutate(publish, {
      onSuccess: (result) => {
        setOutcome({ kind: "done", result, notOnSite: notOnSite.length });
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

  /** «Зняти» or «Скасувати» in the confirmation (US-31 CL). */
  function answer(confirmed: boolean) {
    const request = confirming;
    setConfirming(null);
    answerUnpublish(request, confirmed, {
      one: (id) => {
        setOutcome(null);
        setRowError(id, undefined);
        unpublishOne.mutate(id, {
          onError: (error) => setRowError(id, errorCodeOf(error)),
        });
      },
      many: (ids) => {
        setOutcome(null);
        unpublishMany.mutate(ids, {
          onSuccess: (result) => {
            setOutcome({ kind: "unpublished", result });
            setSelected(new Set());
          },
          onError: (error) =>
            setOutcome({ kind: "error", code: errorCodeOf(error) }),
        });
      },
    });
  }

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <ProductsTitle brandName={brandName} />
        {/* One group under the title, on the left: the green «Оновити з сайту» (or the way to
            the profile without a website) and «Додати вручну» with a frame. */}
        {profile.data && (
          <div className={styles.actionGroup}>
            <SyncNow profile={profile.data} />
            <AddProductEntry
              profileState={profileState}
              size="medium"
              variant="outline"
            />
          </div>
        )}
      </div>

      {products.isPending && <p>Завантаження…</p>}

      {products.isError && (
        <LoadError
          error={products.error}
          onRetry={() => void products.refetch()}
        />
      )}

      {products.isSuccess && products.data.length === 0 && (
        <p className={styles.empty}>{t.empty}</p>
      )}

      {products.isSuccess && products.data.length > 0 && (
        <ProductsListView
          cards={products.data}
          selected={selected}
          onSelect={setSelected}
          profileState={profileState}
          publishing={publishMany.isPending}
          onPublish={publishIds}
          outcome={outcome}
          publishingIds={publishingIds}
          onPublishOne={publishId}
          rowErrors={rowErrors}
          onRemoveFromList={(id) => removeFromList.mutate(id)}
          removingIds={removingIds}
          onUnpublish={setConfirming}
          confirming={confirming}
          onAnswerUnpublish={answer}
          unpublishingIds={unpublishingIds}
          unpublishingMany={unpublishMany.isPending}
        />
      )}
    </section>
  );
}
