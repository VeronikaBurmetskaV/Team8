import { useState } from "react";
import { Link } from "react-router";
import { withUtm } from "../../shared/links";
import { cartTexts as t } from "../../shared/messages.uk";
import { formatPrice } from "../../shared/price";
import { readCart, removeFromCart, type CartItem } from "./cart";
import styles from "./CartPage.module.css";

/** «Одразу в кошик» list from the feed, stored only in this browser. Buying happens on the brand's site. */
export function CartPage() {
  const [items, setItems] = useState<CartItem[]>(() => readCart());

  return (
    <section className={styles.page} aria-labelledby="cart-title">
      <h1 id="cart-title" className={styles.title}>
        {t.title}
      </h1>

      {items.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.text}>{t.empty}</p>
          <Link to="/feed" className={styles.primaryLink}>
            {t.toFeed}
          </Link>
        </div>
      ) : (
        <ul className={styles.list} aria-label={t.listLabel}>
          {items.map((item) => (
            <CartRow
              key={item.id}
              item={item}
              onRemove={() => setItems(removeFromCart(item.id))}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function CartRow({ item, onRemove }: { item: CartItem; onRemove: () => void }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const href = withUtm(item.productUrl);

  return (
    <li className={styles.item}>
      <div className={styles.photoBox}>
        {photoFailed ? (
          <span className={styles.photoPlaceholder} aria-hidden="true">
            FULLA
          </span>
        ) : (
          <img
            className={styles.photo}
            src={item.photoUrl}
            alt={item.name}
            loading="lazy"
            onError={() => setPhotoFailed(true)}
          />
        )}
      </div>
      <div className={styles.info}>
        <p className={styles.name}>{item.name}</p>
        <p className={styles.brand}>{item.brandName}</p>
        <p className={styles.price}>{formatPrice(item.priceUah)}</p>
        <div className={styles.buttons}>
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
            className={styles.removeButton}
            aria-label={t.removeLabel(item.name)}
            onClick={onRemove}
          >
            {t.remove}
          </button>
        </div>
      </div>
    </li>
  );
}
