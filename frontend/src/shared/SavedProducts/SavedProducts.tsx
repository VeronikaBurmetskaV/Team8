import {
  useEffect,
  useReducer,
  useRef,
  type Dispatch,
  type KeyboardEvent,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Link } from "react-router";
import { CloseIcon } from "../icons";
import { isNearLimit } from "../favoritesLimit";
import {
  confirmTexts,
  favoritesLimitTexts as limitTexts,
  savedProductsTexts as t,
} from "../messages.uk";
import { ProductCard } from "../ProductCard/ProductCard";
import type { DetailedProduct } from "../productLists";
import { ProductModal } from "./ProductModal";
import {
  initialSavedProductsState,
  savedProductsReducer,
  type SavedProductsAction,
  type SavedProductsState,
} from "./savedProductsState";
import styles from "./SavedProducts.module.css";

interface SavedProductsProps {
  titleId: string;
  title: string;
  items: readonly DetailedProduct[];
  emptyText: string;
  /** Links of the empty state; the first one is the main action. */
  emptyLinks: readonly { to: string; text: string }[];
  /** Accessible name of the list. */
  listLabel: string;
  /** aria-label of the «×» on the photo of one product. */
  removeLabel: (name: string) => string;
  /** Called after «Видалити» in the question on the card. */
  onRemove: (id: string) => void;
  /** «Вподобане»: the limit, shown as «18 з 25» instead of the product count. */
  limit?: number;
}

/** Where the focus goes after the next render. */
export type FocusTarget =
  | { kind: "card"; id: string }
  | { kind: "remove"; id: string }
  | { kind: "title" };

type SavedProductsViewProps = SavedProductsProps & {
  state: SavedProductsState;
  dispatch: Dispatch<SavedProductsAction>;
  reduceMotion: boolean;
  /** Asks to move the focus once the update is on the screen. */
  requestFocus: (target: FocusTarget) => void;
};

/** `data-focus-key` of a card or a «×»: how the focus finds them after a render. */
const focusKey = (kind: "card" | "remove", id: string) => `${kind}:${id}`;

/** A stable ref callback: «Скасувати» gets the focus once, when the question appears. */
const focusOnMount = (element: HTMLButtonElement | null) => {
  element?.focus();
};

/**
 * The markup of the page, without hooks. Exported for the tests, which read its element
 * tree in node (there is no DOM test library in the project). Use SavedProducts.
 */
export function SavedProductsView({
  titleId,
  title,
  items,
  emptyText,
  emptyLinks,
  listLabel,
  removeLabel,
  onRemove,
  limit,
  state,
  dispatch,
  reduceMotion,
  requestFocus,
}: SavedProductsViewProps) {
  const openItem = items.find((item) => item.id === state.openId) ?? null;
  const duration = reduceMotion ? 0 : 0.2;

  const cancelRemove = (id: string) => {
    dispatch({ type: "closeQuestion" });
    requestFocus({ kind: "remove", id });
  };

  const confirmRemove = (id: string) => {
    // The focus goes to the next card (or the previous one for the last; the title if none).
    const index = items.findIndex((item) => item.id === id);
    const neighbour = items[index + 1] ?? items[index - 1];
    onRemove(id);
    dispatch({ type: "closeQuestion" });
    requestFocus(
      neighbour !== undefined
        ? { kind: "card", id: neighbour.id }
        : { kind: "title" },
    );
  };

  return (
    <section className={styles.page} aria-labelledby={titleId}>
      <h1 id={titleId} className={styles.title} tabIndex={-1}>
        {title}
        {limit !== undefined ? (
          <span
            className={styles.count}
            data-warning={isNearLimit(items.length, limit) || undefined}
            aria-label={limitTexts.counterLabel(items.length, limit)}
          >
            {limitTexts.counter(items.length, limit)}
          </span>
        ) : (
          items.length > 0 && (
            <span className={styles.count}>{t.count(items.length)}</span>
          )
        )}
      </h1>

      {items.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>{emptyText}</p>
          <div className={styles.emptyLinks}>
            {emptyLinks.map((link, index) => (
              <Link
                key={link.to}
                to={link.to}
                className={
                  index === 0 ? styles.primaryLink : styles.secondaryButton
                }
              >
                {link.text}
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <ul className={styles.grid} aria-label={listLabel}>
          <AnimatePresence initial={false}>
            {items.map((item) => {
              const asking = state.confirmId === item.id;
              const questionId = `${titleId}-remove-${item.id}`;
              const open = () => dispatch({ type: "open", id: item.id });
              // While the question is shown the card is not a button: a click on it does
              // nothing, and the question's own buttons are not nested in a button.
              const cardProps = asking
                ? {}
                : {
                    role: "button",
                    tabIndex: 0,
                    "aria-label": t.openCardLabel(item.name),
                    "data-focus-key": focusKey("card", item.id),
                    onClick: open,
                    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault(); // Space must not scroll the page.
                      open();
                    },
                  };

              return (
                <motion.li
                  key={item.id}
                  className={styles.item}
                  layout={!reduceMotion}
                  exit={
                    reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }
                  }
                  transition={{ duration: reduceMotion ? 0 : 0.25 }}
                >
                  <div className={styles.cardBox}>
                    <div className={styles.cardButton} {...cardProps}>
                      <ProductCard
                        card={item}
                        flippable={false}
                        photoBlurred={asking}
                        photoOverlay={
                          <AnimatePresence>
                            {asking && (
                              <motion.div
                                key="question"
                                className={styles.question}
                                role="alertdialog"
                                aria-labelledby={questionId}
                                initial={
                                  reduceMotion
                                    ? false
                                    : { opacity: 0, scale: 0.94 }
                                }
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration }}
                                onKeyDown={(event: KeyboardEvent) => {
                                  if (event.key !== "Escape") return;
                                  event.preventDefault();
                                  event.stopPropagation();
                                  cancelRemove(item.id);
                                }}
                              >
                                <p
                                  id={questionId}
                                  className={styles.questionText}
                                >
                                  {t.removeQuestion}
                                </p>
                                <div className={styles.questionActions}>
                                  <button
                                    type="button"
                                    className={styles.questionConfirm}
                                    onClick={() => confirmRemove(item.id)}
                                  >
                                    {t.removeConfirm}
                                  </button>
                                  <button
                                    ref={focusOnMount}
                                    type="button"
                                    className={styles.questionCancel}
                                    onClick={() => cancelRemove(item.id)}
                                  >
                                    {confirmTexts.cancel}
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        }
                      />
                    </div>
                    {!asking && (
                      <button
                        type="button"
                        className={styles.removeButton}
                        aria-label={removeLabel(item.name)}
                        title={removeLabel(item.name)}
                        data-focus-key={focusKey("remove", item.id)}
                        onClick={(event) => {
                          event.stopPropagation(); // never opens the card
                          dispatch({ type: "askRemove", id: item.id });
                        }}
                      >
                        <CloseIcon />
                      </button>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      <ProductModal
        product={openItem}
        onClose={() => dispatch({ type: "close" })}
      />
    </section>
  );
}

/**
 * A page with a grid of saved products, each drawn by the one ProductCard (NFR-17) in its
 * compact form; the whole card opens the full card (with «Перейти на сайт бренду») over the
 * page. The «×» on the photo blurs it and asks «Впевнені, що хочете видалити товар?» right
 * on the card. Phone: one column; tablet: 3 in a row; laptop: 4.
 */
export function SavedProducts(props: SavedProductsProps) {
  const [state, dispatch] = useReducer(
    savedProductsReducer,
    initialSavedProductsState,
  );
  const reduceMotion = useReducedMotion() ?? false;
  const pendingFocus = useRef<FocusTarget | null>(null);
  const { titleId } = props;

  // After every render: move the focus asked for by the last action, if any.
  useEffect(() => {
    const target = pendingFocus.current;
    if (target === null) return;
    pendingFocus.current = null;
    const element =
      target.kind === "title"
        ? document.getElementById(titleId)
        : document.querySelector<HTMLElement>(
            `[data-focus-key="${CSS.escape(focusKey(target.kind, target.id))}"]`,
          );
    element?.focus();
  });

  return (
    <SavedProductsView
      {...props}
      state={state}
      dispatch={dispatch}
      reduceMotion={reduceMotion}
      requestFocus={(target) => {
        pendingFocus.current = target;
      }}
    />
  );
}
