import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { getFeed } from "../../api/client";
import type { FeedCard } from "../../api/types";
import { errorMessage } from "../../shared/errors";
import {
  CartIcon,
  CloseIcon,
  HeartIcon,
  QuestionIcon,
} from "../../shared/icons";
import { feedTexts as t } from "../../shared/messages.uk";
import { ProductCard } from "../../shared/ProductCard/ProductCard";
import { addToFavorites } from "../../shared/productLists";
import { addToCart } from "../cart/cart";
import { demoPictureNumber, withDemoFallback } from "./demoFeed";
import { HintDialog } from "./HintDialog";
import { feedCommandForKey } from "./keyboard";
import { currentCard, emptyProgress, feedReducer, pendingCards } from "./queue";
import { SwipeCard, type SwipeDirection } from "./SwipeCard";
import styles from "./FeedPage.module.css";

export const feedQueryKey = ["feed"] as const;

const TOAST_MS = 2000;

/** Swipe feed (US-08.1, US-08.2, US-09, US-10). Works anonymously, no forms in front (BR-03). */
export function FeedPage() {
  const feed = useQuery({ queryKey: feedQueryKey, queryFn: getFeed });
  const { items, isDemo } = useMemo(
    () => withDemoFallback(feed.data?.items, feed.isError, import.meta.env.DEV),
    [feed.data, feed.isError],
  );

  const [progress, dispatch] = useReducer(feedReducer, emptyProgress);
  const pending = pendingCards(items, progress);
  const current = currentCard(items, progress);

  /** The card that was just decided and is flying off; the next one is already under it. */
  const [flying, setFlying] = useState<{
    card: FeedCard;
    direction: SwipeDirection;
  } | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [toastId, setToastId] = useState(0);
  // Opens only by the «?» button, never on its own.
  const [hintOpen, setHintOpen] = useState(false);

  useEffect(() => {
    if (toastId === 0) return;
    const timer = window.setTimeout(() => setToastId(0), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toastId]);

  /** Like or skip of the current card: swipe, buttons and keys all end here (BR-11). */
  const decide = useCallback(
    (direction: SwipeDirection): boolean => {
      // While a card is flying off nothing else is accepted (US-10 S2); the reducer also
      // ignores a second decision for the same ID.
      if (flying !== null || current === null) return false;
      dispatch({
        type: direction === "right" ? "like" : "skip",
        id: current.id,
      });
      // A like (swipe right or «Сподобалось») goes to the one «Вподобане» (localStorage).
      if (direction === "right") addToFavorites(current);
      setFlying({ card: current, direction });
      return true;
    },
    [current, flying],
  );

  const handleExited = useCallback(() => {
    setFlying(null);
    setFlipped(false);
  }, []);

  const handleAddToCart = useCallback(() => {
    if (current === null || flying !== null) return;
    addToCart(current);
    setToastId((id) => id + 1);
  }, [current, flying]);

  // Keyboard: ← not today, → like, space flips. Latest handlers via a ref.
  const keyHandlers = useRef({
    decide,
    flip: () => setFlipped((value) => !value),
  });
  useEffect(() => {
    keyHandlers.current = { decide, flip: () => setFlipped((value) => !value) };
  });
  const canAct = current !== null && flying === null && !hintOpen;
  useEffect(() => {
    if (!canAct) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const command = feedCommandForKey({
        key: event.key,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        targetTag: target?.tagName,
        targetEditable: target?.isContentEditable,
      });
      if (command === null) return;
      event.preventDefault();
      if (command === "flip") keyHandlers.current.flip();
      else keyHandlers.current.decide(command === "like" ? "right" : "left");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canAct]);

  // Top of the deck: the flying card, else the current one. Under it: the next card.
  const top = flying?.card ?? current;
  const under = flying !== null ? current : (pending[1] ?? null);
  const actionsDisabled = current === null || flying !== null;

  /** Demo cards show a grey «Картинка N» stub; real cards keep their photo. */
  const photoStub = (card: FeedCard): string | undefined => {
    if (!isDemo) return undefined;
    const number = demoPictureNumber(card.id);
    return number === null ? undefined : t.demoPicture(number);
  };

  let content;
  if (feed.isPending) {
    content = <p className={styles.status}>{t.loading}</p>;
  } else if (feed.isError && !isDemo) {
    content = (
      <div className={styles.status}>
        <p role="alert">{errorMessage(feed.error)}</p>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => feed.refetch()}
        >
          {t.retry}
        </button>
      </div>
    );
  } else if (top === null) {
    // Everything viewed, or no published cards at all (US-08.1 S2, CL).
    content = (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>{t.allViewed}</p>
        <Link to="/favorites" className={styles.primaryLink}>
          {t.toFavorites}
        </Link>
      </div>
    );
  } else {
    content = (
      <div className={styles.stage}>
        <div className={styles.deck} role="region" aria-label={t.cardRegion}>
          {under !== null && (
            <div
              key={under.id}
              className={styles.underCard}
              aria-hidden="true"
              inert
            >
              <ProductCard
                card={under}
                flipped={false}
                photoStub={photoStub(under)}
              />
            </div>
          )}
          <SwipeCard
            key={top.id}
            card={top}
            exit={flying?.direction ?? null}
            onSwipe={decide}
            onExited={handleExited}
            flipped={flipped}
            onFlippedChange={setFlipped}
            photoStub={photoStub(top)}
            backAction={
              // On the back side with the details; the cart logic is unchanged.
              <button
                type="button"
                className={styles.cartButton}
                aria-label={t.toCartLabel}
                disabled={actionsDisabled}
                onClick={handleAddToCart}
              >
                <CartIcon className={styles.cartIcon} />
                {t.toCart}
              </button>
            }
          />
        </div>

        {/* Beside the card where there is room, under it on a phone and tablet.
            «Не сьогодні» left, «Сподобалось» right — the same sides as the swipes. */}
        <button
          type="button"
          className={`${styles.actionButton} ${styles.skipButton}`}
          aria-label={t.skipLabel}
          disabled={actionsDisabled}
          onClick={() => decide("left")}
        >
          <span className={styles.actionCircle}>
            <CloseIcon className={styles.actionIcon} />
          </span>
          <span className={styles.actionText}>{t.skip}</span>
        </button>
        <button
          type="button"
          className={`${styles.actionButton} ${styles.likeButton}`}
          aria-label={t.likeLabel}
          disabled={actionsDisabled}
          onClick={() => decide("right")}
        >
          <span className={styles.actionCircle}>
            <HeartIcon className={styles.actionIcon} />
          </span>
          <span className={styles.actionText}>{t.like}</span>
        </button>

        {/* Brand page is US-20 (Post-MVP): a placeholder without a link for now. */}
        <p className={styles.brandLink}>
          <span aria-disabled="true" title={t.soon}>
            {t.brandAll(top.brandName)}
          </span>
          <span className={styles.soonBadge}>{t.soon}</span>
        </p>
      </div>
    );
  }

  return (
    <section className={styles.page} aria-labelledby="feed-title">
      <div className={styles.topBar}>
        <h1 id="feed-title" className={styles.visuallyHidden}>
          {t.title}
        </h1>
        <span className={styles.hintWrap}>
          <button
            type="button"
            className={styles.hintButton}
            aria-label={t.hintOpen}
            aria-haspopup="dialog"
            onClick={() => setHintOpen(true)}
          >
            <QuestionIcon />
          </button>
          {/* Shown on hover and on keyboard focus; the button already has the same aria-label. */}
          <span className={styles.hintTooltip} aria-hidden="true">
            {t.hintOpen}
          </span>
        </span>
      </div>

      {content}

      <p className={styles.toast} role="status" data-visible={toastId !== 0}>
        {toastId !== 0 ? t.addedToCart : ""}
      </p>

      <HintDialog open={hintOpen} onClose={() => setHintOpen(false)} />
    </section>
  );
}
