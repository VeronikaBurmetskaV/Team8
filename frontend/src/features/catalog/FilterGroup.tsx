import { useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import styles from "./CatalogPage.module.css";

interface FilterGroupProps {
  /** Prefix of the element IDs of the group. */
  id: string;
  title: string;
  /** Short text next to the title, e.g. the applied price range. */
  summary?: string;
  /** Open when the panel appears (e.g. «Ціна» with an applied filter). */
  initialOpen?: boolean;
  children: ReactNode;
}

/** A group of the filter panel: the whole heading row toggles it, «+» closed, «−» open. */
export function FilterGroup({
  initialOpen = false,
  ...props
}: FilterGroupProps) {
  const [open, setOpen] = useState(initialOpen);
  const reduceMotion = useReducedMotion() ?? false;
  return (
    <FilterGroupView
      {...props}
      open={open}
      onToggle={() => setOpen((value) => !value)}
      reduceMotion={reduceMotion}
    />
  );
}

interface FilterGroupViewProps extends Omit<FilterGroupProps, "initialOpen"> {
  open: boolean;
  onToggle: () => void;
  reduceMotion: boolean;
}

/** Hook-free markup of a group (rendered by tests without a DOM). */
export function FilterGroupView({
  id,
  title,
  summary,
  children,
  open,
  onToggle,
  reduceMotion,
}: FilterGroupViewProps) {
  const buttonId = `${id}-button`;
  const bodyId = `${id}-body`;
  return (
    <div className={styles.group}>
      <h3 className={styles.groupHeading}>
        <button
          id={buttonId}
          type="button"
          className={styles.groupToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
        >
          <span className={styles.groupTitle}>
            {title}
            {summary !== undefined && summary !== "" && (
              <span className={styles.groupCurrent}>{summary}</span>
            )}
          </span>
          <span className={styles.groupIcon} aria-hidden="true">
            {open ? "−" : "+"}
          </span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            id={bodyId}
            role="region"
            aria-labelledby={buttonId}
            // Clipped only while the height animates, so focus rings and the slider thumbs
            // are never cut off once the group is open.
            initial={{ height: 0, opacity: 0, overflow: "hidden" }}
            animate={{
              height: "auto",
              opacity: 1,
              transitionEnd: { overflow: "visible" },
            }}
            exit={{ height: 0, opacity: 0, overflow: "hidden" }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
