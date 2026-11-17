import type { ReactNode } from "react";
import { Link } from "react-router";
import { withUtm } from "../links";
import { savedProductsTexts as t } from "../messages.uk";
import { ProductCard } from "../ProductCard/ProductCard";
import type { SavedProduct } from "../productLists";
import styles from "./SavedProducts.module.css";

interface SavedProductsProps {
  titleId: string;
  title: string;
  items: readonly SavedProduct[];
  emptyText: string;
  emptyLinkTo: string;
  emptyLinkText: string;
  /** Accessible name of the list. */
  listLabel: string;
  /** Text of the «Прибрати» button's aria-label for one product. */
  removeLabel: (name: string) => string;
  onRemove: (id: string) => void;
  /** Extra button before «Перейти на сайт бренду» (e.g. «Додати у Вподобане»). */
  extraAction?: (item: SavedProduct) => ReactNode;
}

/**
 * A page with a grid of saved products, each drawn by the one ProductCard (NFR-17),
 * with «Перейти на сайт бренду» (new tab, utm_source=fulla) and «Прибрати» under it.
 * Phone: one column; tablet: 3 in a row; laptop: 4 in a row.
 */
export function SavedProducts({
  titleId,
  title,
  items,
  emptyText,
  emptyLinkTo,
  emptyLinkText,
  listLabel,
  removeLabel,
  onRemove,
  extraAction,
}: SavedProductsProps) {
  return (
    <section className={styles.page} aria-labelledby={titleId}>
      <h1 id={titleId} className={styles.title}>
        {title}
        {items.length > 0 && (
          <span className={styles.count}>{t.count(items.length)}</span>
        )}
      </h1>

      {items.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>{emptyText}</p>
          <Link to={emptyLinkTo} className={styles.primaryLink}>
            {emptyLinkText}
          </Link>
        </div>
      ) : (
        <ul className={styles.grid} aria-label={listLabel}>
          {items.map((item) => {
            const href = withUtm(item.productUrl);
            return (
              <li key={item.id} className={styles.item}>
                <div className={styles.cardBox}>
                  <ProductCard card={item} />
                </div>
                <div className={styles.actions}>
                  {extraAction?.(item)}
                  {href !== null && (
                    <a
                      className={styles.primaryLink}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t.goToBrandSiteLabel(item.name)}
                    >
                      {t.goToBrandSite}
                    </a>
                  )}
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    aria-label={removeLabel(item.name)}
                    onClick={() => onRemove(item.id)}
                  >
                    {t.remove}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Class for an extra action button so it looks like the others. */
export const savedProductsButtonClass = styles.secondaryButton;
