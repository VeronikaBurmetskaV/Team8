import { useState, type ReactNode } from "react";
import type { FeedCard, ProductColor } from "../../api/types";
import { RotateIcon } from "../icons";
import { productCardTexts as t } from "../messages.uk";
import { formatPrice } from "../price";
import styles from "./ProductCard.module.css";

/** Only a plain `#rrggbb` from the data becomes a swatch colour. */
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

interface ProductCardProps {
  card: FeedCard;
  /** Controlled flip (the feed flips by keyboard too); omit to let the card keep its own state. */
  flipped?: boolean;
  onFlippedChange?: (flipped: boolean) => void;
  /** Text of a plain grey stub shown instead of the photo (demo data only). */
  photoStub?: string;
  /** Extra control on the back side under the details (the feed puts «Одразу в кошик» here). */
  backAction?: ReactNode;
}

/**
 * The ONE product card renderer (NFR-17): the swipe feed, «Вподобане» and the brand preview.
 * Front: photo + name, brand, price (US-08.2), sizes and colours when the data has them.
 * Back: details. The brand logo is never shown (US-08.2 CL). The card fills its parent;
 * the parent decides the size, the card switches to the side column when it is wide enough.
 */
export function ProductCard({
  card,
  flipped: flippedProp,
  onFlippedChange,
  photoStub,
  backAction,
}: ProductCardProps) {
  const [ownFlipped, setOwnFlipped] = useState(false);
  const flipped = flippedProp ?? ownFlipped;
  const setFlipped = (value: boolean) => {
    if (flippedProp === undefined) setOwnFlipped(value);
    onFlippedChange?.(value);
  };

  const sizes = card.sizes ?? [];
  const colors = card.colors ?? [];
  const hasDetails =
    Boolean(card.material) || Boolean(card.description) || sizes.length > 0;

  return (
    <article
      className={styles.card}
      aria-label={`${card.name}, ${card.brandName}, ${formatPrice(card.priceUah)}`}
    >
      <div className={styles.inner} data-flipped={flipped}>
        <div
          className={`${styles.face} ${styles.front}`}
          inert={flipped}
          aria-hidden={flipped}
        >
          <div className={styles.photoBox}>
            {photoStub !== undefined ? (
              <div
                className={styles.photoStub}
                role="img"
                aria-label={photoStub}
              >
                <span aria-hidden="true">{photoStub}</span>
              </div>
            ) : (
              <ProductPhoto
                key={card.photoUrl}
                url={card.photoUrl}
                alt={card.name}
              />
            )}
          </div>

          <div className={styles.info}>
            <h2 className={styles.name} title={card.name}>
              {card.name}
            </h2>
            <p className={styles.brand} title={card.brandName}>
              {card.brandName}
            </p>
            <p className={styles.price}>{formatPrice(card.priceUah)}</p>

            {sizes.length > 0 && (
              <div className={styles.group}>
                <h3 className={styles.groupTitle}>{t.sizes}</h3>
                <ul className={styles.sizes}>
                  {sizes.map((size) => (
                    <li
                      key={size.label}
                      className={styles.size}
                      data-available={size.available}
                      aria-label={
                        size.available
                          ? t.sizeAvailable(size.label)
                          : t.sizeUnavailable(size.label)
                      }
                      title={
                        size.available
                          ? t.sizeAvailable(size.label)
                          : t.sizeUnavailable(size.label)
                      }
                    >
                      {size.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {colors.length > 0 && (
              <div className={styles.group}>
                <h3 className={styles.groupTitle}>{t.colors}</h3>
                <ul className={styles.colors}>
                  {colors.map((color) => (
                    <ColorSwatch key={color.name} color={color} />
                  ))}
                </ul>
              </div>
            )}

            <button
              type="button"
              className={styles.flipButton}
              aria-label={t.flipLabel}
              onClick={() => setFlipped(true)}
            >
              <RotateIcon className={styles.flipIcon} />
              {t.flip}
            </button>
          </div>
        </div>

        <div
          className={`${styles.face} ${styles.back}`}
          inert={!flipped}
          aria-hidden={!flipped}
        >
          <div className={styles.backScroll}>
            <p className={styles.backKicker}>{t.detailsTitle}</p>
            <h2 className={styles.backName}>{card.name}</h2>
            <p className={styles.brand}>{card.brandName}</p>

            <dl className={styles.details}>
              {card.material && (
                <div className={styles.detail}>
                  <dt>{t.material}</dt>
                  <dd>{card.material}</dd>
                </div>
              )}
              {sizes.length > 0 && (
                <div className={styles.detail}>
                  <dt>{t.sizes}</dt>
                  <dd>
                    {sizes.map((size, index) => (
                      <span key={size.label}>
                        {index > 0 && ", "}
                        <span
                          className={
                            size.available
                              ? undefined
                              : styles.sizeTextUnavailable
                          }
                          aria-label={
                            size.available
                              ? t.sizeAvailable(size.label)
                              : t.sizeUnavailable(size.label)
                          }
                        >
                          {size.label}
                        </span>
                      </span>
                    ))}
                  </dd>
                </div>
              )}
              {card.description && (
                <div className={styles.detail}>
                  <dt>{t.description}</dt>
                  <dd className={styles.description}>{card.description}</dd>
                </div>
              )}
              <div className={styles.detail}>
                <dt>{t.price}</dt>
                <dd className={styles.backPrice}>
                  {formatPrice(card.priceUah)}
                </dd>
              </div>
            </dl>
            {!hasDetails && <p className={styles.noDetails}>{t.noDetails}</p>}
          </div>

          {backAction}

          <button
            type="button"
            className={styles.flipButton}
            aria-label={t.backLabel}
            onClick={() => setFlipped(false)}
          >
            <RotateIcon className={styles.flipIcon} />
            {t.back}
          </button>
        </div>
      </div>
    </article>
  );
}

/** Photo with a placeholder on error; the text and the buttons keep working (US-08.2 S2, NFR-10). */
function ProductPhoto({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(url.trim() === "");
  if (failed) {
    return (
      <div
        className={styles.photoPlaceholder}
        role="img"
        aria-label={t.photoPlaceholder}
      >
        <span aria-hidden="true">FULLA</span>
        <span className={styles.photoPlaceholderText}>
          {t.photoPlaceholder}
        </span>
      </div>
    );
  }
  return (
    <img
      className={styles.photo}
      src={url}
      alt={alt}
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

function ColorSwatch({ color }: { color: ProductColor }) {
  // `hex` is null for a colour name the importer doesn't know (api.md §2.2).
  const hex =
    color.hex !== null && HEX_COLOR.test(color.hex) ? color.hex : null;
  return (
    <li
      className={styles.color}
      data-unknown={hex === null}
      // The product's own colour comes from the data, not from the palette tokens.
      style={hex !== null ? { backgroundColor: hex } : undefined}
      title={color.name}
      aria-label={color.name}
    />
  );
}
