import { CloseIcon } from "../../shared/icons";
import { catalogTexts as t } from "../../shared/messages.uk";
import type { FilterChip } from "./catalog";
import styles from "./CatalogPage.module.css";

interface FilterChipsProps {
  chips: readonly FilterChip[];
  /** ✕ of a chip: removes only that filter. */
  onRemove: (chipId: string) => void;
  onResetAll: () => void;
}

/** Chips of the active filters with ✕ and «Скинути все» (with two or more): / and /feed. */
export function FilterChips({ chips, onRemove, onResetAll }: FilterChipsProps) {
  if (chips.length === 0) return null;
  return (
    <div className={styles.chips}>
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          className={styles.chip}
          aria-label={chip.removeLabel}
          onClick={() => onRemove(chip.id)}
        >
          {chip.label}
          <CloseIcon />
        </button>
      ))}
      {chips.length > 1 && (
        <button
          type="button"
          className={styles.textButton}
          onClick={onResetAll}
        >
          {t.resetAll}
        </button>
      )}
    </div>
  );
}

/**
 * «Повернути фільтри: …» on a page opened without filters while some are remembered. Quiet
 * text button: one click applies them; nothing is applied without it.
 */
export function RestoreFiltersButton({
  label,
  onRestore,
}: {
  label: string;
  onRestore: () => void;
}) {
  return (
    <button type="button" className={styles.restoreButton} onClick={onRestore}>
      {label}
    </button>
  );
}
