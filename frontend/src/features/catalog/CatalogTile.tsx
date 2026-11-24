import { useState } from "react";
import { Link } from "react-router";
import type { PublicCard } from "../../api/types";
import { HeartIcon } from "../../shared/icons";
import { catalogTexts as t } from "../../shared/messages.uk";
import { formatPrice } from "../../shared/price";
import { toggleFavorite } from "../../shared/productLists";
import { cardRevealDelay, useReveal } from "../../shared/reveal";
import { brandHref } from "./catalog";
import styles from "./CatalogTile.module.css";

interface CatalogTileProps {
  card: PublicCard;
  isFavorite: boolean;
  /** Place in the grid (reading order): sets the entrance-animation stagger on page load. */
  index: number;
}

/**
 * A product in the catalogue grid: photo 3:4, brand, name, price and a heart that adds the
 * product to the shared «Вподобане». The brand name links to the clothes of that brand
 * (/?brand=<key>, the brand filter); it is a separate element from the heart, so a click on
 * it never likes the product. The tile itself opens nothing yet; the brand logo is never
 * shown to buyers.
 */
export function CatalogTile({ card, isFavorite, index }: CatalogTileProps) {
  // Rises into place when it scrolls into view; cards visible on load go in reading order.
  const revealRef = useReveal<HTMLElement>(cardRevealDelay(index), true);
  return (
    <article ref={revealRef} className={styles.tile}>
      <div className={styles.photoBox}>
        <TilePhoto key={card.photoUrl} url={card.photoUrl} alt={card.name} />
        <button
          type="button"
          className={styles.heart}
          aria-label={t.favoriteLabel(card.name)}
          aria-pressed={isFavorite}
          onClick={() => toggleFavorite(card)}
        >
          <HeartIcon fill={isFavorite ? "currentColor" : "none"} />
        </button>
      </div>
      <Link
        to={brandHref(card.brandName)}
        className={styles.brand}
        aria-label={t.brandLinkLabel(card.brandName.trim())}
        title={card.brandName}
        // Same route (/), so the browser would keep the scroll: start at the top.
        onClick={() => window.scrollTo({ top: 0 })}
      >
        {card.brandName}
      </Link>
      <h3 className={styles.name} title={card.name}>
        {card.name}
      </h3>
      <p className={styles.price}>{formatPrice(card.priceUah)}</p>
    </article>
  );
}

/** Photo with a placeholder on error (NFR-10). */
function TilePhoto({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(url.trim() === "");
  if (failed) {
    return (
      <div
        className={styles.placeholder}
        role="img"
        aria-label={t.photoPlaceholder}
      >
        <span aria-hidden="true">FULLA</span>
      </div>
    );
  }
  return (
    <img
      className={styles.photo}
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

/** Grey stub of a tile while the catalogue loads. */
export function CatalogTileSkeleton() {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      <div className={styles.skeletonPhoto} />
      <div className={styles.skeletonLine} />
      <div className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
    </div>
  );
}
