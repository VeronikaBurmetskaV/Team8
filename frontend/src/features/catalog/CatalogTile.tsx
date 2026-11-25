import { useState, type Ref } from "react";
import { Link } from "react-router";
import type { FeedCard } from "../../api/types";
import { HeartIcon } from "../../shared/icons";
import {
  catalogTexts as t,
  savedProductsTexts,
} from "../../shared/messages.uk";
import { formatPrice } from "../../shared/price";
import {
  showFavoritesLimit,
  useFavoritesLimit,
} from "../../shared/favoritesLimit";
import { toggleFavorite } from "../../shared/productLists";
import { cardRevealDelay, useReveal } from "../../shared/reveal";
import { SizeRow } from "../../shared/ProductCard/SizeRow";
import { brandHref, brandSpelling } from "./catalog";
import styles from "./CatalogTile.module.css";

interface CatalogTileProps {
  card: FeedCard;
  isFavorite: boolean;
  /** Place in the grid (reading order): sets the entrance-animation stagger on page load. */
  index: number;
  /** Opens the full card (CatalogPage puts ?product=<id> in the URL). */
  onOpen?: (card: FeedCard) => void;
}

/**
 * The heart's action, shared by the tile and the full card (one state, one limit): likes or
 * unlikes; over the «Вподобане» limit nothing changes and the dialog explains why.
 */
export function likeFromCatalog(card: FeedCard, limit: number) {
  if (toggleFavorite(card, undefined, limit) === "limit") {
    showFavoritesLimit();
  }
}

/**
 * A product in the catalogue grid: photo 3:4, brand, name, price with the sizes in stock and a heart that adds the
 * product to the shared «Вподобане». The brand name links to the clothes of that brand
 * (/?brand=<key>, the brand filter); it is a separate element from the heart, so a click on
 * it never likes the product. The brand logo is never shown to buyers.
 *
 * A click anywhere else on the tile (or Enter / Space on it) opens the full card: a
 * transparent button «Відкрити картку: …» lies over the whole tile, UNDER the heart and the
 * brand link (CSS z-index), so it changes nothing in the look. Those two stay separate
 * elements next to it — not inside it — so their clicks never reach it and they keep their
 * own keyboard focus (a role="button" around them would hide them from screen readers).
 */
export function CatalogTile({
  card,
  isFavorite,
  index,
  onOpen,
}: CatalogTileProps) {
  // Rises into place when it scrolls into view; cards visible on load go in reading order.
  const revealRef = useReveal<HTMLElement>(cardRevealDelay(index), true);
  const { limit } = useFavoritesLimit();
  return (
    <CatalogTileView
      card={card}
      isFavorite={isFavorite}
      onOpen={onOpen}
      // Over the limit the heart stays empty and the dialog explains why.
      onLike={() => likeFromCatalog(card, limit)}
      revealRef={revealRef}
    />
  );
}

/** Hook-free markup of a tile (rendered by tests without a DOM). */
export function CatalogTileView({
  card,
  isFavorite,
  onOpen,
  onLike,
  revealRef,
}: {
  card: FeedCard;
  isFavorite: boolean;
  onOpen?: (card: FeedCard) => void;
  onLike: () => void;
  revealRef?: Ref<HTMLElement>;
}) {
  return (
    <article ref={revealRef} className={styles.tile}>
      {onOpen !== undefined && (
        <button
          type="button"
          className={styles.open}
          aria-label={savedProductsTexts.openCardLabel(card.name)}
          data-open-product={card.id}
          onClick={() => onOpen(card)}
        />
      )}
      <div className={styles.photoBox}>
        <TilePhoto key={card.photoUrl} url={card.photoUrl} alt={card.name} />
        <button
          type="button"
          className={styles.heart}
          aria-label={t.favoriteLabel(card.name)}
          aria-pressed={isFavorite}
          onClick={onLike}
        >
          <HeartIcon fill={isFavorite ? "currentColor" : "none"} />
        </button>
      </div>
      <Link
        to={brandHref(card.brandName)}
        className={styles.brand}
        aria-label={t.brandLinkLabel(brandSpelling(card.brandName))}
        title={card.brandName}
        // Same route (/), so the browser would keep the scroll: start at the top.
        onClick={() => window.scrollTo({ top: 0 })}
      >
        {card.brandName}
      </Link>
      <h3 className={styles.name} title={card.name}>
        {card.name}
      </h3>
      {/* Price left, the sizes in stock right; under the price on a narrow tile. */}
      <div className={styles.priceRow}>
        <p className={styles.price}>{formatPrice(card.priceUah)}</p>
        <SizeRow sizes={card.sizes} variant="tile" />
      </div>
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
