import { useEffect, useRef } from "react";
import { CloseIcon } from "../../shared/icons";
import { feedTexts as t } from "../../shared/messages.uk";
import styles from "./FeedPage.module.css";

interface HintDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The «?» instruction. A native modal <dialog>: focus stays inside, Esc closes it,
 * focus returns to the «?» button. A click on the backdrop closes it too.
 */
export function HintDialog({ open, onClose }: HintDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.hintDialog}
      aria-labelledby="feed-hint-title"
      // Esc and dialog.close() both end here.
      onClose={onClose}
      onClick={(event) => {
        // The content fills the dialog box, so a click on the dialog itself is the backdrop.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.hintContent}>
        <button
          type="button"
          className={styles.hintClose}
          aria-label={t.hintClose}
          title={t.hintClose}
          onClick={onClose}
        >
          <CloseIcon />
        </button>
        <h2 id="feed-hint-title" className={styles.hintTitle}>
          {t.hintTitle}
        </h2>
        <ul className={styles.hintList}>
          {t.hintLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className={styles.hintKeyboard}>{t.hintKeyboard}</p>
      </div>
    </dialog>
  );
}
