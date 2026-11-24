import { useReducer, type Dispatch } from "react";
import { catalogTexts as t } from "../../shared/messages.uk";
import {
  committedRange,
  hasPriceRange,
  initialPriceDraft,
  priceApplyLabel,
  priceDraftReducer,
  samePriceRange,
  type PriceDraft,
  type PriceDraftAction,
  type PriceRange,
  type PriceThumb,
} from "./catalog";
import { PriceRangeSlider } from "./PriceRangeSlider";
import styles from "./CatalogPage.module.css";

interface PriceFilterProps {
  /** Prefix of the element IDs inside the group. */
  id: string;
  /** The range applied in the URL; both sides null without a filter. */
  applied: PriceRange;
  onApply: (range: PriceRange) => void;
  onReset: () => void;
}

/**
 * Body of the «Ціна» group: [Від … грн] – [До … грн], the two-thumb slider (kept in sync)
 * and the «Показати …» button that names the range it applies. Opens on the applied range;
 * the parent gives it a new `key` when the URL range changes. Nothing is applied until the
 * button (or Enter in a field); with the applied range unchanged the button is disabled.
 */
export function PriceFilter(props: PriceFilterProps) {
  const [draft, dispatch] = useReducer(
    priceDraftReducer,
    props.applied,
    initialPriceDraft,
  );
  return <PriceFilterView {...props} draft={draft} onDraft={dispatch} />;
}

interface PriceFilterViewProps extends PriceFilterProps {
  draft: PriceDraft;
  onDraft: Dispatch<PriceDraftAction>;
}

/** Hook-free markup of the price group body (rendered by tests without a DOM). */
export function PriceFilterView({
  id,
  applied,
  onApply,
  onReset,
  draft,
  onDraft,
}: PriceFilterViewProps) {
  // What the button would apply right now (a field still being typed in counts too).
  const next = committedRange(draft);
  const unchanged = samePriceRange(next, applied);
  const apply = () => {
    if (!unchanged) onApply(next);
  };

  function field(thumb: PriceThumb, label: string, text: string) {
    const inputId = `${id}-${thumb}`;
    return (
      <div className={styles.priceField}>
        <label htmlFor={inputId} className={styles.priceLabel}>
          {label}
        </label>
        <div className={styles.priceInputBox}>
          <input
            id={inputId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="done"
            className={styles.priceInput}
            value={text}
            onChange={(event) =>
              onDraft({ type: "type", thumb, text: event.target.value })
            }
            onBlur={() => onDraft({ type: "commit", thumb })}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              // Enter = the button: the field is committed and the range applied.
              onDraft({ type: "commit", thumb });
              apply();
            }}
          />
          <span className={styles.priceSuffix} aria-hidden="true">
            {t.currency}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.priceBody}>
      <div className={styles.priceFields}>
        {field("min", t.priceFromLabel, draft.minText)}
        <span className={styles.priceDash} aria-hidden="true">
          –
        </span>
        {field("max", t.priceToLabel, draft.maxText)}
      </div>

      <PriceRangeSlider
        min={draft.min}
        max={draft.max}
        onSlide={(thumb, value) => onDraft({ type: "slide", thumb, value })}
      />

      <button
        type="button"
        className={styles.applyButton}
        disabled={unchanged}
        onClick={apply}
      >
        {priceApplyLabel(next)}
      </button>

      {hasPriceRange(applied) && (
        <button
          type="button"
          className={styles.textButton}
          aria-label={t.priceResetLabel}
          onClick={onReset}
        >
          {t.priceReset}
        </button>
      )}
    </div>
  );
}
