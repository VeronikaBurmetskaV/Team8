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
  /** Links of the empty state; the first one is the main action. */
  emptyLinks: readonly { to: string; text: string }[];
  /** Accessible name of the list. */
  listLabel: string;
  /** Text of the «Прибрати» button's aria-label for one product. */
  removeLabel: (name: string) => string;
  onRemove: (id: string) => void;
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
  emptyLinks,
  listLabel,
  removeLabel,
  onRemove,
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
          {items.map((item) => {
            const href = withUtm(item.productUrl);
            return (
              <li key={item.id} className={styles.item}>
                <div className={styles.cardBox}>
                  <ProductCard card={item} />
                </div>
                <div className={styles.actions}>
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
