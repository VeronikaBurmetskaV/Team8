import { useLayoutEffect, useRef, useState, type Ref } from "react";
import type { ProductSize } from "../../api/types";
import { productCardTexts as t } from "../messages.uk";
import {
  lowStockQuantity,
  sizesInStock,
  stockHint,
  uniqueSizes,
  type StockHint,
} from "../sizes";
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
  /**
   * The circles, in the filter's order: the sizes in stock (sizesInStock) on the tile, every
   * size (uniqueSizes) on the card, where sold-out ones are grey and struck through.
   */
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
  // The label names only the sizes in stock; a sold-out circle says so in its own label.
  const inStock = sizes.filter((size) => size.available);
  // Any red badge: a wider gap, so a badge never covers the next circle.
  const hasBadges = sizes.some((size) => lowStockQuantity(size) !== null);
  return (
    <div
      ref={rowRef}
      className={styles.row}
      data-variant={variant}
      data-badges={hasBadges}
    >
      <div className={styles.group}>
        <ul
          className={styles.list}
          aria-label={t.sizesInStockLabel(inStock.map((size) => size.label))}
        >
          {sizes.slice(0, visible).map((size) => (
            <SizeDot key={size.label} size={size} labelled />
          ))}
          {hidden > 0 && (
            <li className={styles.more} aria-label={t.moreSizesLabel(hidden)}>
              {t.moreSizes(hidden)}
            </li>
          )}
        </ul>
      </div>
      {/* All circles and a «+N», invisible: only to measure what fits. */}
      <ul ref={measureRef} className={styles.measure} aria-hidden="true">
        {sizes.map((size) => (
          <SizeDot key={size.label} size={size} labelled={false} />
        ))}
        <li className={styles.more}>{t.moreSizes(sizes.length)}</li>
      </ul>
    </div>
  );
}

/**
 * One size circle: grey and struck through when sold out; with a red badge of ITS OWN items left
 * when the source states 1–4 (lowStockQuantity). `labelled`: the visible copy names the state
 * for screen readers (the badge itself is hidden from them).
 */
function SizeDot({ size, labelled }: { size: ProductSize; labelled: boolean }) {
  const count = lowStockQuantity(size);
  let label: string | undefined;
  if (labelled && !size.available) label = t.soldOutSizeLabel(size.label);
  if (labelled && count !== null)
    label = t.lowStockSizeLabel(size.label, count);
  return (
    <li
      className={styles.dot}
      data-available={size.available}
      aria-label={label}
    >
      {size.label}
      {count !== null && (
        <span className={styles.badge} aria-hidden="true">
          {count}
        </span>
      )}
    </li>
  );
}

/**
 * The sizes as circles in the filter's order, in ONE line (the card never grows): what does not
 * fit becomes «+N». The tile shows only the sizes IN STOCK; the card shows every size, sold-out
 * ones grey and struck through (like the back side). A size whose exact count the source states
 * as 1–4 gets its own red badge; there is no count of the sizes left (it is not a count of items).
 * All sold out: a small grey «Немає в наявності». Nothing for cards without sizes
 * (brand-made cards). Only shown, not buttons: the swipe goes through them like through the rest
 * of the text.
 */
export function SizeRow({
  sizes,
  variant,
}: {
  sizes: readonly ProductSize[] | undefined;
  variant: SizeRowVariant;
}) {
  const shown =
    variant === "card" ? uniqueSizes(sizes ?? []) : sizesInStock(sizes ?? []);
  const hint = stockHint(sizes);
  const [visible, setVisible] = useState(shown.length);
  const rowRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLUListElement>(null);
  const key = shown
    .map(
      (size) =>
        `${size.label}:${String(size.available)}:${String(size.quantity)}`,
    )
    .join("|");

  useLayoutEffect(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    if (row === null || measure === null) return;
    const update = () => {
      const dots = [...measure.children] as HTMLElement[];
      const more = dots.pop();
      const gap = parseFloat(getComputedStyle(measure).columnGap) || 0;
      // The circles get the row's content width: its padding is the room for the badges.
      const rowStyle = getComputedStyle(row);
      const padding =
        (parseFloat(rowStyle.paddingLeft) || 0) +
        (parseFloat(rowStyle.paddingRight) || 0);
      setVisible(
        fitSizes(
          dots.map((dot) => dot.getBoundingClientRect().width),
          gap,
          row.clientWidth - padding,
          more?.getBoundingClientRect().width ?? 0,
        ),
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(row);
    return () => observer.disconnect();
  }, [key]);

  if (hint === null && shown.length === 0) return null;
  return (
    <SizeRowView
      sizes={shown}
      hint={hint}
      visible={Math.min(visible, shown.length)}
      variant={variant}
      rowRef={rowRef}
      measureRef={measureRef}
    />
  );
}
