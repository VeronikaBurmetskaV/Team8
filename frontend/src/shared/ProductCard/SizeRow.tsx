import { useLayoutEffect, useRef, useState, type Ref } from "react";
import type { ProductSize } from "../../api/types";
import { productCardTexts as t } from "../messages.uk";
import { sizesInStock, stockHint, type StockHint } from "../sizes";
import styles from "./SizeRow.module.css";

/**
 * How many circles fit in one line of `available` px: all of them, or as many as still leave
 * room for the «+N» circle. `widths` are the circles in order, `gap` the space between two.
 */
export function fitSizes(
  widths: readonly number[],
  gap: number,
  available: number,
  moreWidth: number,
): number {
  const total = widths.reduce(
    (sum, width, index) => sum + width + (index > 0 ? gap : 0),
    0,
  );
  if (total <= available) return widths.length;
  let used = moreWidth;
  let count = 0;
  for (const width of widths) {
    if (used + gap + width > available) break;
    used += gap + width;
    count += 1;
  }
  return count;
}

/** Tile: small circles, right of the price. Card: a bit larger, under the price. */
export type SizeRowVariant = "tile" | "card";

interface SizeRowViewProps {
  /** The sizes in stock, in the filter's order (sizesInStock). */
  sizes: readonly ProductSize[];
  hint: StockHint | null;
  /** How many circles fit; the rest becomes «+N». */
  visible: number;
  variant: SizeRowVariant;
  rowRef?: Ref<HTMLDivElement>;
  measureRef?: Ref<HTMLUListElement>;
}

/** The markup without hooks (the tests read it in node). Use SizeRow. */
export function SizeRowView({
  sizes,
  hint,
  visible,
  variant,
  rowRef,
  measureRef,
}: SizeRowViewProps) {
  if (hint?.kind === "none") {
    return (
      <p className={styles.none} data-variant={variant}>
        {t.stockNone}
      </p>
    );
  }
  const hidden = sizes.length - visible;
  const few = hint?.kind === "few" ? hint : null;
  return (
    <div ref={rowRef} className={styles.row} data-variant={variant}>
      <div className={styles.group}>
        <ul
          className={styles.list}
          aria-label={t.sizesInStockLabel(
            sizes.map((size) => size.label),
            few === null ? null : t.stockFew(few.count),
          )}
        >
          {sizes.slice(0, visible).map((size) => (
            <li key={size.label} className={styles.dot}>
              {size.label}
            </li>
          ))}
          {hidden > 0 && (
            <li className={styles.more} aria-label={t.moreSizesLabel(hidden)}>
              {t.moreSizes(hidden)}
            </li>
          )}
        </ul>
        {/* Like a notification badge; the list label says the same in words. */}
        {few !== null && (
          <span className={styles.count} aria-hidden="true">
            {few.count}
          </span>
        )}
      </div>
      {/* All circles and a «+N», invisible: only to measure what fits. */}
      <ul ref={measureRef} className={styles.measure} aria-hidden="true">
        {sizes.map((size) => (
          <li key={size.label} className={styles.dot}>
            {size.label}
          </li>
        ))}
        <li className={styles.more}>{t.moreSizes(sizes.length)}</li>
      </ul>
    </div>
  );
}

/**
 * Only the sizes IN STOCK, as circles in the filter's order, in ONE line (the card never
 * grows): what does not fit becomes «+N». 1–2 left (LOW_STOCK_SIZES): a red count over the group. All sold out:
 * a small grey «Немає в наявності». Nothing for cards without sizes (brand-made cards). Only
 * shown, not buttons: the swipe goes through them like through the rest of the text.
 */
export function SizeRow({
  sizes,
  variant,
}: {
  sizes: readonly ProductSize[] | undefined;
  variant: SizeRowVariant;
}) {
  const inStock = sizesInStock(sizes ?? []);
  const hint = stockHint(sizes);
  const [visible, setVisible] = useState(inStock.length);
  const rowRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLUListElement>(null);
  const key = inStock.map((size) => size.label).join("|");

  useLayoutEffect(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    if (row === null || measure === null) return;
    const update = () => {
      const dots = [...measure.children] as HTMLElement[];
      const more = dots.pop();
      const gap = parseFloat(getComputedStyle(measure).columnGap) || 0;
      setVisible(
        fitSizes(
          dots.map((dot) => dot.getBoundingClientRect().width),
          gap,
          row.clientWidth,
          more?.getBoundingClientRect().width ?? 0,
        ),
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(row);
    return () => observer.disconnect();
  }, [key]);

  if (hint === null && inStock.length === 0) return null;
  return (
    <SizeRowView
      sizes={inStock}
      hint={hint}
      visible={Math.min(visible, inStock.length)}
      variant={variant}
      rowRef={rowRef}
      measureRef={measureRef}
    />
  );
}
