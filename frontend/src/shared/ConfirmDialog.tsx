import { useEffect, useId, useRef, type Ref } from "react";
import { motion, useReducedMotion } from "motion/react";
import { confirmTexts } from "./messages.uk";
import { handleCancelEvent, isBackdropClick, openModal } from "./modalControl";
import styles from "./ConfirmDialog.module.css";

type ConfirmDialogProps = {
  open: boolean;
  /** The question; it also names the dialog for screen readers. */
  title: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  /** «Скасувати», Esc and a click on the dimmed backdrop. */
  onCancel: () => void;
};

type ConfirmDialogViewProps = Required<ConfirmDialogProps> & {
  titleId: string;
  reduceMotion: boolean;
  dialogRef?: Ref<HTMLDialogElement>;
  cancelRef?: Ref<HTMLButtonElement>;
};

/**
 * The markup of the dialog, without hooks. Exported for the tests, which read its element
 * tree in node (there is no DOM test library in the project). Use ConfirmDialog.
 */
export function ConfirmDialogView({
  open,
  title,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  titleId,
  reduceMotion,
  dialogRef,
  cancelRef,
}: ConfirmDialogViewProps) {
  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      role="alertdialog"
      aria-labelledby={titleId}
      onCancel={(event) => handleCancelEvent(event, onCancel)}
      onClick={(event) => {
        if (isBackdropClick(event)) onCancel();
      }}
    >
      {open && (
        <motion.div
          className={styles.content}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <div className={styles.actions}>
            <button
              ref={cancelRef}
              type="button"
              className={styles.cancel}
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
            <button type="button" onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </motion.div>
      )}
    </dialog>
  );
}

/**
 * One confirmation dialog for the whole app, on the native <dialog> with showModal(): focus
 * stays inside, Esc works, the page behind is dimmed. The focus starts on «Скасувати» and goes
 * back to the button that opened the dialog when it closes. The owner keeps `open` in state.
 */
export function ConfirmDialog({
  cancelLabel = confirmTexts.cancel,
  ...props
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const reduceMotion = useReducedMotion() ?? false;
  const { open } = props;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || dialog === null) return;
    const active = document.activeElement;
    const opener = active instanceof HTMLElement ? active : null;
    return openModal(dialog, opener, cancelRef.current);
  }, [open]);

  return (
    <ConfirmDialogView
      {...props}
      cancelLabel={cancelLabel}
      titleId={titleId}
      reduceMotion={reduceMotion}
      dialogRef={dialogRef}
      cancelRef={cancelRef}
    />
  );
}
