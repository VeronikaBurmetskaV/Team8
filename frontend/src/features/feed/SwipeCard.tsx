import { useEffect, useRef, type ReactNode } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from "motion/react";
import type { FeedCard } from "../../api/types";
import { feedTexts as t } from "../../shared/messages.uk";
import { ProductCard } from "../../shared/ProductCard/ProductCard";
import styles from "./FeedPage.module.css";

export type SwipeDirection = "left" | "right";

/** Release further than this (px) or faster than this (px/s) counts as a swipe. */
const SWIPE_DISTANCE = 120;
const SWIPE_VELOCITY = 600;

interface SwipeCardProps {
  card: FeedCard;
  /** Set by the page after a decision: the card flies off to that side, then onExited. */
  exit: SwipeDirection | null;
  /** Drag released past the threshold. Returns false when the page ignores it. */
  onSwipe: (direction: SwipeDirection) => boolean;
  onExited: () => void;
  flipped: boolean;
  onFlippedChange: (flipped: boolean) => void;
  /** Passed to ProductCard: the demo stub text and the control on the back side. */
  photoStub?: string;
  backAction?: ReactNode;
}

/**
 * The top card of the deck. Gesture modelled on react-tinder-card (drag, tilt, fly-out),
 * built on `motion` (ADR-0008). A swipe and a button press end in the same page action (BR-11).
 */
export function SwipeCard({
  card,
  exit,
  onSwipe,
  onExited,
  flipped,
  onFlippedChange,
  photoStub,
  backAction,
}: SwipeCardProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const x = useMotionValue(0);
  const rotate = useTransform(
    x,
    [-300, 0, 300],
    reduceMotion ? [0, 0, 0] : [-14, 0, 14],
  );
  const likeOpacity = useTransform(x, [24, SWIPE_DISTANCE], [0, 1]);
  const skipOpacity = useTransform(x, [-SWIPE_DISTANCE, -24], [1, 0]);

  const onExitedRef = useRef(onExited);
  useEffect(() => {
    onExitedRef.current = onExited;
  });

  useEffect(() => {
    if (exit === null) return;
    let cancelled = false;
    const distance = window.innerWidth + 400;
    const controls = animate(
      x,
      exit === "right" ? distance : -distance,
      reduceMotion ? { duration: 0 } : { duration: 0.32, ease: "easeIn" },
    );
    controls.then(() => {
      if (!cancelled) onExitedRef.current();
    });
    return () => {
      cancelled = true;
      controls.stop();
    };
  }, [exit, reduceMotion, x]);

  function handleDragEnd(
    _event: PointerEvent | MouseEvent | TouchEvent,
    info: PanInfo,
  ) {
    const { x: dx } = info.offset;
    const { x: vx } = info.velocity;
    let direction: SwipeDirection | null = null;
    if (dx > SWIPE_DISTANCE || (dx > 0 && vx > SWIPE_VELOCITY))
      direction = "right";
    if (dx < -SWIPE_DISTANCE || (dx < 0 && vx < -SWIPE_VELOCITY))
      direction = "left";
    if (direction !== null && onSwipe(direction)) return;
    animate(
      x,
      0,
      reduceMotion
        ? { duration: 0 }
        : { type: "spring", stiffness: 420, damping: 32 },
    );
  }

  return (
    <motion.div
      className={styles.swipeCard}
      style={{ x, rotate }}
      drag={exit === null ? "x" : false}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
    >
      <ProductCard
        card={card}
        flipped={flipped}
        onFlippedChange={onFlippedChange}
        photoStub={photoStub}
        backAction={backAction}
      />
      <motion.span
        className={`${styles.stamp} ${styles.stampLike}`}
        style={{ opacity: likeOpacity }}
        aria-hidden="true"
      >
        {t.stampLike}
      </motion.span>
      <motion.span
        className={`${styles.stamp} ${styles.stampSkip}`}
        style={{ opacity: skipOpacity }}
        aria-hidden="true"
      >
        {t.stampSkip}
      </motion.span>
    </motion.div>
  );
}
