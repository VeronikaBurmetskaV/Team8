import { catalogTexts as t } from "../../shared/messages.uk";
import type { SizeOption } from "./catalog";
import styles from "./CatalogPage.module.css";

interface SizeFilterProps {
  id: string;
  /** Sizes in stock, in size order; null while the catalogue is loading. */
  options: readonly SizeOption[] | null;
  /** Chosen size keys (sizeKey). */
  selected: readonly string[];
  /** A click applies at once and a second click removes the size (like the brands). */
  onToggle: (key: string) => void;
}

/**
 * «Розмір»: a fieldset (legend «Розмір») with one round button per size in stock (a pill for long ones such as «One size» or
 * «XS/S»), several at once. Each is a toggle: aria-pressed tells whether it is chosen, the
 * accessible name says how many products have it.
 */
export function SizeFilter({
  id,
  options,
  selected,
  onToggle,
}: SizeFilterProps) {
  if (options === null) {
    return <p className={styles.groupSoon}>{t.brandLoading}</p>;
  }
  if (options.length === 0) {
    return <p className={styles.groupSoon}>{t.sizeEmpty}</p>;
  }
  const chosen = new Set(selected);
  return (
    // A group of toggles: the legend names it for screen readers (the visible title is the
    // group heading above).
    <fieldset className={styles.sizeFieldset}>
      <legend className={styles.visuallyHidden}>{t.sizeGroup}</legend>
      <ul
        id={`${id}-list`}
        className={styles.sizeList}
        aria-label={t.sizeListLabel}
      >
        {options.map((option) => (
          <li key={option.key}>
            <button
              type="button"
              className={styles.size}
              aria-pressed={chosen.has(option.key)}
              aria-label={t.sizeLabel(option.label, option.count)}
              title={t.sizeLabel(option.label, option.count)}
              onClick={() => onToggle(option.key)}
            >
              {option.label}
            </button>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
