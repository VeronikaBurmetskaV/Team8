import { useEffect, useRef, type KeyboardEvent } from "react";
import { CloseIcon } from "../../shared/icons";
import { catalogTexts as t } from "../../shared/messages.uk";
import styles from "./CatalogPage.module.css";

interface FilterPanelProps {
  id: string;
  /** Below --bp-desktop the panel is a drawer over the page; on a laptop, a column. */
  isDrawer: boolean;
  onClose: () => void;
}

/**
 * Placeholder filter groups: headings that expand to «Скоро». No filter logic: categories,
 * sizes, brands and feed settings are Out of Scope of the MVP (US-04…US-07).
 */
export function FilterPanel({ id, isDrawer, onClose }: FilterPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Keyboard users land in the panel when it opens.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // The drawer covers the page: the page behind it does not scroll.
  useEffect(() => {
    if (!isDrawer) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isDrawer]);

  /** In the drawer, Tab cycles inside the panel, so focus never goes behind the backdrop. */
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!isDrawer || event.key !== "Tab" || panelRef.current === null) return;
    const focusable =
      panelRef.current.querySelectorAll<HTMLElement>("button, summary");
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (first === undefined || last === undefined) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      {isDrawer && (
        <div className={styles.backdrop} aria-hidden="true" onClick={onClose} />
      )}
      <aside
        ref={panelRef}
        id={id}
        className={styles.panel}
        aria-labelledby={`${id}-title`}
        role={isDrawer ? "dialog" : undefined}
        aria-modal={isDrawer ? true : undefined}
        onKeyDown={onKeyDown}
      >
        <div className={styles.panelHeader}>
          <h2 id={`${id}-title`} className={styles.panelTitle}>
            {t.filters}
          </h2>
          <button
            ref={closeRef}
            type="button"
            className={styles.iconButton}
            aria-label={t.filtersClose}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
        {t.filterGroups.map((group) => (
          <details key={group} className={styles.group}>
            <summary className={styles.groupSummary}>{group}</summary>
            <p className={styles.groupSoon}>{t.soon}</p>
          </details>
        ))}
      </aside>
    </>
  );
}
