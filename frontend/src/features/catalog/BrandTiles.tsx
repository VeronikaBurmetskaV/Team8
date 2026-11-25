import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { getBrands } from "../../api/client";
import { Link } from "react-router";
import { catalogTexts as t } from "../../shared/messages.uk";
import { useContentHeight } from "../../shared/useContentHeight";
import { useMediaQuery } from "../../shared/useMediaQuery";
import { brandHref, type BrandOption } from "./catalog";
import {
  BRAND_TILE_MEDIA,
  BRAND_TILE_ROWS,
  brandTileColumns,
  hasHiddenBrandTiles,
  logosByKey,
  monogram,
  monogramStyle,
  visibleBrandTiles,
} from "./brandGrid";
import styles from "./BrandTiles.module.css";

const TITLE_ID = "brand-tiles-title";
const LIST_ID = "brand-tiles-list";
const NO_LOGOS: ReadonlyMap<string, string> = new Map();

/** GET /api/brands: only for the logos; the tiles themselves come from the feed. */
export const brandsQueryKey = ["brands"] as const;

/**
 * «Бренди» on the home page: a square tile per brand of the catalogue (brandOptions of
 * GET /api/feed, no logos: PublicCard has none). A tile opens the brand page /?brand=<key>.
 * CatalogPage renders it only on the clean home page (showBrandTiles).
 */
export function BrandTiles({
  options,
}: {
  options: readonly BrandOption[] | null;
}) {
  const columns = brandTileColumns({
    tablet: useMediaQuery(BRAND_TILE_MEDIA.tablet),
    desktop: useMediaQuery(BRAND_TILE_MEDIA.desktop),
    wide: useMediaQuery(BRAND_TILE_MEDIA.wide),
  });
  const [expanded, setExpanded] = useState(false);
  const { ref, height } = useContentHeight<HTMLUListElement>();
  const reduceMotion = useReducedMotion() ?? false;
  // Logos are an extra: while loading or on an error every tile keeps its monogram.
  const brands = useQuery({ queryKey: brandsQueryKey, queryFn: getBrands });
  const logos = brands.data ? logosByKey(brands.data) : NO_LOGOS;

  return (
    <BrandTilesView
      options={options}
      logos={logos}
      columns={columns}
      expanded={expanded}
      onToggle={() => setExpanded((open) => !open)}
      listRef={ref}
      height={height}
      reduceMotion={reduceMotion}
    />
  );
}

interface BrandTilesViewProps {
  /** null while the catalogue is loading: skeleton tiles. */
  options: readonly BrandOption[] | null;
  /** Logo URL per brand key (GET /api/brands); a brand without one shows its monogram. */
  logos?: ReadonlyMap<string, string>;
  columns: number;
  expanded: boolean;
  onToggle: () => void;
  listRef?: Ref<HTMLUListElement>;
  /** Measured height of the list; the wrapper animates to it. */
  height?: number | "auto";
  reduceMotion?: boolean;
}

/** Hook-free part of the block: heading, grid, «Усі бренди (N)» / «Згорнути». */
export function BrandTilesView({
  options,
  logos = NO_LOGOS,
  columns,
  expanded,
  onToggle,
  listRef,
  height = "auto",
  reduceMotion = false,
}: BrandTilesViewProps) {
  const loading = options === null;
  const all = options ?? [];
  const shown = visibleBrandTiles(all, columns, expanded);
  const canExpand = hasHiddenBrandTiles(all, columns);

  return (
    <section
      className={styles.section}
      aria-labelledby={TITLE_ID}
      aria-busy={loading || undefined}
    >
      <h2 id={TITLE_ID} className={styles.title}>
        {t.brandsTitle}
        {!loading && (
          <span className={styles.count}>{t.brandsCount(all.length)}</span>
        )}
      </h2>

      {loading ? (
        <>
          <p className={styles.visuallyHidden} role="status">
            {t.brandsLoading}
          </p>
          <div className={styles.grid} aria-hidden="true">
            {Array.from({ length: columns * BRAND_TILE_ROWS }, (_, index) => (
              <div key={index} className={styles.skeleton} />
            ))}
          </div>
        </>
      ) : (
        <motion.div
          className={styles.listBox}
          animate={{ height }}
          initial={false}
          transition={{ duration: reduceMotion ? 0 : 0.3, ease: "easeOut" }}
        >
          <ul
            ref={listRef}
            id={LIST_ID}
            className={`${styles.grid} ${styles.list}`}
          >
            {shown.map((option) => (
              <li key={option.key}>
                <BrandTile
                  option={option}
                  logoUrl={logos.get(option.key) ?? null}
                />
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {canExpand && (
        <div className={styles.more}>
          <button
            type="button"
            className={styles.moreButton}
            aria-expanded={expanded}
            aria-controls={LIST_ID}
            onClick={onToggle}
          >
            {expanded ? t.brandsCollapse : t.brandsAll(all.length)}
          </button>
        </div>
      )}
    </section>
  );
}

interface BrandTileProps {
  option: BrandOption;
  /** From GET /api/brands; null → the monogram. */
  logoUrl?: string | null;
}

/**
 * One square tile. With a logo URL the square shows the logo; when there is none, or the image
 * fails to load, the coloured monogram (the logo is never required).
 */
export function BrandTile({ option, logoUrl = null }: BrandTileProps) {
  // The URL that failed: a new URL (fresh data) gets a new try.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const truncated = useIsTruncated(nameRef, option.label);
  return (
    <BrandTileView
      option={option}
      logoUrl={logoUrl !== null && logoUrl !== failedUrl ? logoUrl : null}
      onLogoError={() => setFailedUrl(logoUrl)}
      nameRef={nameRef}
      truncated={truncated}
    />
  );
}

/**
 * Whether the one-line name is cut off with «…» (wider than its box). Measured after render
 * and again when the tile changes size; false on the server and until measured.
 */
function useIsTruncated(
  ref: { current: HTMLElement | null },
  text: string,
): boolean {
  const [truncated, setTruncated] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const measure = () =>
      setTruncated(element.scrollWidth > element.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, text]);
  return truncated;
}

interface BrandTileViewProps {
  option: BrandOption;
  /** The logo to show, or null for the monogram. */
  logoUrl: string | null;
  onLogoError: () => void;
  /** The name's <span>, measured by BrandTile. */
  nameRef?: Ref<HTMLSpanElement>;
  /** The name is cut off: the full name is shown over this tile on hover and focus. */
  truncated?: boolean;
}

/**
 * Hook-free markup of a tile: logo or monogram, the name on one line, the product count.
 *
 * No native `title`: the browser draws it next to the mouse pointer, not over the tile, so on the
 * grid it covered the neighbouring tile — and it only repeated the name shown under the logo.
 * Only a name cut off with «…» gets the full name, drawn inside this tile's own box (so it can't
 * cover another tile or leave the screen). Screen readers get the full name from aria-label.
 */
export function BrandTileView({
  option,
  logoUrl,
  onLogoError,
  nameRef,
  truncated = false,
}: BrandTileViewProps) {
  return (
    <div className={styles.tileWrap}>
      <Link
        to={brandHref(option.key)}
        className={styles.tile}
        style={monogramStyle(option.key) as CSSProperties}
        aria-label={t.brandTileLabel(option.label, option.count)}
        // The brand page starts at its top, like «← Весь одяг».
        onClick={() => window.scrollTo({ top: 0 })}
      >
        {logoUrl !== null ? (
          <span className={styles.logoBox}>
            <img
              className={styles.logo}
              src={logoUrl}
              alt={t.brandLogoAlt(option.label)}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={onLogoError}
            />
          </span>
        ) : (
          <span className={styles.monogram} aria-hidden="true">
            {monogram(option.label)}
          </span>
        )}
        <span className={styles.caption} aria-hidden="true">
          <span ref={nameRef} className={styles.name}>
            {option.label}
          </span>
          <span className={styles.tileCount}>
            {t.brandTileCount(option.count)}
          </span>
        </span>
      </Link>
      {truncated && (
        <span className={styles.tooltip} aria-hidden="true">
          {option.label}
        </span>
      )}
    </div>
  );
}
