import { useState, type CSSProperties } from "react";
import { CheckIcon } from "../../shared/icons";
import { catalogTexts as t } from "../../shared/messages.uk";
import {
  BRAND_LIST_LIMIT,
  BRAND_SEARCH_MIN,
  brandKey,
  visibleBrands,
  type BrandOption,
} from "./catalog";
import styles from "./CatalogPage.module.css";

interface BrandFilterProps {
  id: string;
  /** Brands of the catalogue; null while the products are loading. */
  options: readonly BrandOption[] | null;
  /** Chosen brand keys (from the URL). */
  selected: readonly string[];
  /** A click on a brand applies at once: adds or removes it in the URL. */
  onToggle: (key: string) => void;
  /**
   * «Показати всі» / «Згорнути». The panel owns this state: expanded, it widens (a laptop) or
   * fills the screen (the drawer), and it starts collapsed again at the next opening.
   */
  expanded: boolean;
  onToggleExpanded: () => void;
}

/**
 * Body of the «Бренд» group: a checkbox per brand with its product count. Collapsed: the
 * first BRAND_LIST_LIMIT and every chosen brand; expanded: all of them in 2–3 columns. With
 * more than BRAND_SEARCH_MIN brands a search field filters the list as you type.
 */
export function BrandFilter(props: BrandFilterProps) {
  const [query, setQuery] = useState("");
  return <BrandFilterView {...props} query={query} onQuery={setQuery} />;
}

interface BrandFilterViewProps extends BrandFilterProps {
  query: string;
  onQuery: (query: string) => void;
}

/** Hook-free markup of the brand list (rendered by tests without a DOM). */
export function BrandFilterView({
  id,
  options,
  selected,
  onToggle,
  expanded,
  onToggleExpanded,
  query,
  onQuery,
}: BrandFilterViewProps) {
  if (options === null) {
    return <p className={styles.groupSoon}>{t.brandLoading}</p>;
  }
  const chosen = new Set(selected);
  const searching = brandKey(query) !== "";
  const shown = visibleBrands(options, selected, { expanded, query });
  const listId = `${id}-list`;
  const searchId = `${id}-search`;
  // Columns of the expanded list follow the longest name (CSS keeps them between
  // --brand-column-min and --brand-column-max); with the checkbox and the count beside it,
  // the longest name may wrap to a second line rather than force a single column.
  const longest = Math.max(...options.map((option) => option.label.length), 0);
  const columns = { "--brand-name-width": `${longest}ch` } as CSSProperties;

  return (
    <fieldset className={styles.brandList}>
      <legend className={styles.visuallyHidden}>{t.brandGroup}</legend>

      {options.length > BRAND_SEARCH_MIN && (
        <div className={styles.brandSearch}>
          <label htmlFor={searchId} className={styles.visuallyHidden}>
            {t.brandSearchLabel}
          </label>
          <input
            id={searchId}
            type="search"
            className={styles.brandSearchInput}
            placeholder={t.brandSearchLabel}
            autoComplete="off"
            enterKeyHint="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
          />
          <p className={styles.visuallyHidden} aria-live="polite">
            {searching ? t.brandsFound(shown.length) : ""}
          </p>
        </div>
      )}

      <div
        id={listId}
        className={styles.brandOptions}
        data-expanded={expanded || searching}
        style={columns}
      >
        {shown.map((option) => {
          const inputId = `${id}-${option.key}`;
          return (
            <label
              key={option.key}
              htmlFor={inputId}
              className={styles.brandOption}
            >
              <input
                id={inputId}
                type="checkbox"
                className={styles.checkboxInput}
                checked={chosen.has(option.key)}
                onChange={() => onToggle(option.key)}
              />
              <span className={styles.checkboxBox} aria-hidden="true">
                <CheckIcon />
              </span>
              <span className={styles.brandName}>{option.label}</span>
              <span className={styles.brandCount}>
                {t.brandCount(option.count)}
              </span>
            </label>
          );
        })}
      </div>

      {searching && shown.length === 0 && (
        <p className={styles.groupSoon}>{t.brandSearchEmpty}</p>
      )}

      {/* One element in both states, so the focus stays on it after the click. */}
      {!searching && options.length > BRAND_LIST_LIMIT && (
        <button
          type="button"
          className={styles.textButton}
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={onToggleExpanded}
        >
          {expanded ? t.brandCollapse : t.brandShowAll(options.length)}
        </button>
      )}
    </fieldset>
  );
}
