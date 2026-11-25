import { useEffect, useId, useRef, type Ref } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useNavigate } from "react-router";
import { CloseIcon } from "./icons";
import {
  hideFavoritesLimit,
  useFavoritesLimit,
  useFavoritesLimitOpen,
} from "./favoritesLimit";
import { favoritesLimitTexts as t } from "./messages.uk";
import { handleCancelEvent, isBackdropClick, openModal } from "./modalControl";
import styles from "./FavoritesLimitDialog.module.css";

interface FavoritesLimitDialogViewProps {
  open: boolean;
  limit: number;
  isAccount: boolean;
  titleId: string;
  reduceMotion: boolean;
  onRegister: () => void;
  onFavorites: () => void;
  /** ✕, Esc and a click on the dimmed backdrop: closes, nothing is added. */
  onClose: () => void;
  dialogRef?: Ref<HTMLDialogElement>;
  /** The first action (gets the focus when the dialog opens). */
  firstActionRef?: Ref<HTMLButtonElement>;
}

/** The markup without hooks (read by the tests in node). Use FavoritesLimitDialog. */
export function FavoritesLimitDialogView({
  open,
  limit,
  isAccount,
  titleId,
  reduceMotion,
  onRegister,
  onFavorites,
  onClose,
  dialogRef,
  firstActionRef,
}: FavoritesLimitDialogViewProps) {
  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={`${titleId}-text`}
      onCancel={(event) => handleCancelEvent(event, onClose)}
      onClick={(event) => {
        if (isBackdropClick(event)) onClose();
      }}
    >
      {open && (
        <motion.div
          className={styles.content}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <button
            type="button"
            className={styles.close}
            aria-label={t.close}
            title={t.close}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
          <h2 id={titleId} className={styles.title}>
            {t.title(limit)}
          </h2>
          <p id={`${titleId}-text`} className={styles.text}>
            {isAccount ? t.accountText : t.guestText}
          </p>
          <div className={styles.actions}>
            {!isAccount && (
              <button
                ref={firstActionRef}
                type="button"
                className={styles.primary}
                onClick={onRegister}
              >
                {t.register}
              </button>
            )}
            <button
              ref={isAccount ? firstActionRef : undefined}
              type="button"
              className={isAccount ? styles.primary : styles.secondary}
              onClick={onFavorites}
            >
              {t.toFavorites}
            </button>
          </div>
        </motion.div>
      )}
    </dialog>
  );
}

/**
 * «Вподобане заповнене»: opened by showFavoritesLimit() when a like or a heart would go over the
 * limit; rendered once in Layout. Native <dialog> like ConfirmDialog: focus stays inside; ✕, Esc
 * and the backdrop close it (nothing is added); the focus starts on the first action and goes
 * back to the button that opened it.
 */
export function FavoritesLimitDialog() {
  const open = useFavoritesLimitOpen();
  const { limit, isAccount } = useFavoritesLimit();
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const reduceMotion = useReducedMotion() ?? false;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || dialog === null) return;
    const active = document.activeElement;
    const opener = active instanceof HTMLElement ? active : null;
    // The focus starts on the first action (not the title) and goes back to the heart or the
    // button that opened the dialog when it closes (openModal).
    return openModal(dialog, opener, firstActionRef.current);
  }, [open]);

  function go(path: string) {
    hideFavoritesLimit();
    navigate(path);
  }

  return (
    <FavoritesLimitDialogView
      open={open}
      limit={limit}
      isAccount={isAccount}
      titleId={titleId}
      reduceMotion={reduceMotion}
      onRegister={() => go("/register")}
      onFavorites={() => go("/favorites")}
      onClose={hideFavoritesLimit}
      dialogRef={dialogRef}
      firstActionRef={firstActionRef}
    />
  );
}
