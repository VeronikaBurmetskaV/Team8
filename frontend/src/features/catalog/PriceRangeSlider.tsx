import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { catalogTexts as t } from "../../shared/messages.uk";
import { formatPrice } from "../../shared/price";
import {
  formatPriceLimit,
  nearestThumb,
  PRICE_MAX,
  PRICE_MIN,
  PRICE_STEP,
  priceAtPointer,
  pricePercent,
  thumbValueForKey,
  type PriceThumb,
} from "./catalog";
import styles from "./CatalogPage.module.css";

interface PriceRangeSliderProps {
  min: number;
  max: number;
  /** A thumb moved to a value; the reducer keeps it in range and a step from the other. */
  onSlide: (thumb: PriceThumb, value: number) => void;
}

/**
 * Two-thumb price slider built on pointer events (not two native ranges): the line spans the
 * full width between the thumb centres, so PRICE_MIN sits exactly on its start and PRICE_MAX
 * exactly on its end. Mouse, touch and pen go through the same pointer handlers; each thumb
 * is a focusable role="slider" with arrows, PageUp/PageDown, Home/End.
 */
export function PriceRangeSlider({ min, max, onSlide }: PriceRangeSliderProps) {
  const lineRef = useRef<HTMLDivElement>(null);
  const minRef = useRef<HTMLDivElement>(null);
  const maxRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<PriceThumb | null>(null);

  function valueAt(clientX: number): number | null {
    const rect = lineRef.current?.getBoundingClientRect();
    return rect ? priceAtPointer(clientX, rect.left, rect.width) : null;
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const value = valueAt(event.clientX);
    if (value === null) return;
    const pressed =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-thumb]")?.dataset.thumb
        : undefined;
    const thumb: PriceThumb =
      pressed === "min" || pressed === "max"
        ? pressed
        : nearestThumb({ min, max }, value);
    dragging.current = thumb;
    event.currentTarget.setPointerCapture(event.pointerId);
    // No text selection or focus change by the browser; the moved thumb gets the focus.
    event.preventDefault();
    (thumb === "min" ? minRef : maxRef).current?.focus();
    // A press on the line moves the nearer thumb there; a press on a thumb only grabs it.
    if (pressed === undefined) onSlide(thumb, value);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (dragging.current === null) return;
    const value = valueAt(event.clientX);
    if (value !== null) onSlide(dragging.current, value);
  }

  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    dragging.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function onKeyDown(thumb: PriceThumb, event: KeyboardEvent<HTMLDivElement>) {
    const next = thumbValueForKey(thumb === "min" ? min : max, event.key);
    if (next === null) return;
    event.preventDefault();
    onSlide(thumb, next);
  }

  const from = pricePercent(min);
  const to = pricePercent(max);
  // Thumbs a step apart overlap: near the right end the min thumb is on top (it is the one
  // that can still move), near the left end the max thumb.
  const minOnTop = min > (PRICE_MIN + PRICE_MAX) / 2;

  return (
    <div
      className={styles.slider}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <div ref={lineRef} className={styles.sliderLine}>
        <div className={styles.sliderTrack} />
        <div
          className={styles.sliderFill}
          style={{ left: `${from}%`, width: `${to - from}%` }}
        />
        <div
          ref={minRef}
          data-thumb="min"
          role="slider"
          tabIndex={0}
          aria-label={t.priceMinThumb}
          aria-orientation="horizontal"
          aria-valuemin={PRICE_MIN}
          aria-valuemax={max - PRICE_STEP}
          aria-valuenow={min}
          aria-valuetext={t.priceFrom(formatPrice(min))}
          className={styles.thumb}
          style={{ left: `${from}%`, zIndex: minOnTop ? 2 : 1 }}
          onKeyDown={(event) => onKeyDown("min", event)}
        />
        <div
          ref={maxRef}
          data-thumb="max"
          role="slider"
          tabIndex={0}
          aria-label={t.priceMaxThumb}
          aria-orientation="horizontal"
          aria-valuemin={min + PRICE_STEP}
          aria-valuemax={PRICE_MAX}
          aria-valuenow={max}
          aria-valuetext={t.priceTo(formatPriceLimit(max))}
          className={styles.thumb}
          style={{ left: `${to}%`, zIndex: minOnTop ? 1 : 2 }}
          onKeyDown={(event) => onKeyDown("max", event)}
        />
      </div>
    </div>
  );
}
