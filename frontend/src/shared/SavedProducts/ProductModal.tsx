import { useEffect, useId, useRef, type Ref } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CloseIcon } from "../icons";
import { withUtm } from "../links";
import { savedProductsTexts as t } from "../messages.uk";
import { handleCancelEvent, lockPageScroll } from "../modalControl";
import { ProductCard } from "../ProductCard/ProductCard";
import type { DetailedProduct } from "../productLists";
import styles from "./ProductModal.module.css";

interface ProductModalProps {
  /** The product to show; null keeps the modal closed. */
  product: DetailedProduct | null;
  /** The «×», Esc and a click on the dimmed page. */
  onClose: () => void;
}

type ProductModalViewProps = ProductModalProps & {
  titleId: string;
  reduceMotion: boolean;
  dialogRef?: Ref<HTMLDialogElement>;
  closeRef?: Ref<HTMLButtonElement>;
  /** Called when the closing animation has ended. */
  onExitComplete?: () => void;
};

/**
 * The markup of the modal, without hooks. Exported for the tests, which read its element
 * tree in node (there is no DOM test library in the project). Use ProductModal.
 */
export function ProductModalView({
  product,
  onClose,
  titleId,
  reduceMotion,
  dialogRef,
  closeRef,
  onExitComplete,
}: ProductModalViewProps) {
  const href = product !== null ? withUtm(product.productUrl) : null;
  const duration = reduceMotion ? 0 : 0.22;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onCancel={(event) => handleCancelEvent(event, onClose)}
    >
      <AnimatePresence onExitComplete={onExitComplete}>
        {product !== null && (
          <motion.div
            key="backdrop"
            className={styles.backdrop}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration }}
          />
        )}
        {product !== null && (
          <motion.div
            key="panel"
            className={styles.panel}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            transition={{ duration, ease: "easeOut" }}
          >
            <button
              ref={closeRef}
              type="button"
              className={styles.close}
              aria-label={t.closeCard}
              title={t.closeCard}
              onClick={onClose}
            >
              <CloseIcon />
            </button>
            <div className={styles.cardBox}>
              <ProductCard card={product} titleId={titleId} />
            </div>
            {href !== null && (
              <a
                className={styles.brandLink}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t.goToBrandSiteLabel(product.name)}
              >
                {t.goToBrandSite}
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </dialog>
  );
}

/**
 * The full product card over «Вподобане» — the same ProductCard as in the feed, with the flip
 * and all the details — and «Перейти на сайт бренду». A native modal <dialog>: focus stays
 * inside and starts on «×», Esc closes it, the page behind is dimmed, blurred and does not
 * scroll. After the closing animation the focus goes back to the card that opened it.
 */
export function ProductModal(props: ProductModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const unlockRef = useRef<(() => void) | null>(null);
  const titleId = useId();
  const reduceMotion = useReducedMotion() ?? false;
  const open = props.product !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || dialog === null) return;
    const active = document.activeElement;
    openerRef.current = active instanceof HTMLElement ? active : null;
    if (!dialog.open) dialog.showModal();
    unlockRef.current ??= lockPageScroll(document.body);
    closeRef.current?.focus();
  }, [open]);

  // Leaving the page with the modal open must not leave the page locked.
  useEffect(
    () => () => {
      unlockRef.current?.();
      unlockRef.current = null;
    },
    [],
  );

  const finishClose = () => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    unlockRef.current?.();
    unlockRef.current = null;
    openerRef.current?.focus();
    openerRef.current = null;
  };

  return (
    <ProductModalView
      {...props}
      titleId={titleId}
      reduceMotion={reduceMotion}
      dialogRef={dialogRef}
      closeRef={closeRef}
      onExitComplete={finishClose}
    />
  );
}
