import { useId, useState } from "react";
import { Link, useSearchParams } from "react-router";
import type {
  BrandCard,
  BulkPublishResponse,
  ErrorCode,
} from "../../api/types";
import { useBrandProfile } from "../../shared/brandProfile";
import { errorCodeOf } from "../../shared/errors";
import { brandProductsTexts as t, messages } from "../../shared/messages.uk";
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
import { useBrandProducts, usePublishBrandProducts } from "./queries";
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
  /** Publishing needs the brand's consent (T-1, US-22.2): without it the buttons are off. */
  consented: boolean;
  publishing: boolean;
  onPublish: (ids: string[]) => void;
  outcome: PublishOutcome;
};

/**
 * The list with the filter, the checkboxes and the bulk publish bar (ADR-0017). Presentational:
 * the page keeps the state, so tests can render every state directly.
 */
export function ProductsListView({
  cards,
  filter,
  onFilter,
  selected,
  onSelect,
  consented,
  publishing,
  onPublish,
  outcome,
}: ViewProps) {
  const filterId = useId();
  const consentHintId = useId();
  const shown = filterCards(cards, filter);
  const shownDrafts = draftIds(shown);
  const toPublish = selectedDrafts(selected, shownDrafts);
  const allSelected =
    shownDrafts.length > 0 && shownDrafts.every((id) => selected.has(id));
  const blocked = !consented || publishing;
  const describedBy = consented ? undefined : consentHintId;

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
            disabled={blocked || toPublish.length === 0}
            aria-describedby={describedBy}
            onClick={() => onPublish(toPublish)}
          >
            {publishing ? t.publishing : t.publishSelected(toPublish.length)}
          </button>
          <button
            type="button"
            className={styles.publishAllButton}
            disabled={blocked || shownDrafts.length === 0}
            aria-describedby={describedBy}
            onClick={() => onPublish(shownDrafts)}
          >
            {t.publishAll(shownDrafts.length)}
          </button>
        </div>
      </div>

      {!consented && (
        <p id={consentHintId} className={styles.consentHint}>
          {t.consentNeeded}{" "}
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
      {outcome?.kind === "error" && (
        <p className={styles.publishError} role="alert">
          {messages[outcome.code]}
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
              <th scope="col">
                <span className={styles.visuallyHidden}>Дії</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((card) => (
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
                    <span className={styles.editedBadge}>{t.editedByHand}</span>
                  )}
                </td>
                <td className={styles.price}>{card.priceUah} грн</td>
                <td className={styles.status}>{statusText[card.status]}</td>
                <td className={styles.actions}>
                  {card.status === "DRAFT" && (
                    <Link
                      to={`/brand/products/${card.id}`}
                      aria-label={t.edit(card.name)}
                    >
                      {t.editShort}
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export function BrandProductsPage() {
  const products = useBrandProducts();
  const profile = useBrandProfile();
  const publish = usePublishBrandProducts();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [outcome, setOutcome] = useState<PublishOutcome>(null);
  const filter = parseFilter(searchParams.get("filter"));

  function changeFilter(next: ProductFilter) {
    const param = filterParam(next);
    setSearchParams(param === null ? {} : { filter: param });
  }

  function publishIds(ids: string[]) {
    setOutcome(null);
    publish.mutate(ids, {
      onSuccess: (result) => {
        setOutcome({ kind: "done", result });
        setSelected(new Set());
      },
      onError: (error) =>
        setOutcome({ kind: "error", code: errorCodeOf(error) }),
    });
  }

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t.title}</h1>
        <AddProductEntry
          profileState={profile.data?.state ?? null}
          size="medium"
        />
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
          consented={profile.data?.state === "CONSENTED"}
          publishing={publish.isPending}
          onPublish={publishIds}
          outcome={outcome}
        />
      )}
    </section>
  );
}
