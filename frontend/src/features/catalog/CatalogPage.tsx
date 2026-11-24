import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { getFeed } from "../../api/client";
import { FiltersIcon } from "../../shared/icons";
import { catalogTexts as t } from "../../shared/messages.uk";
import { favoriteList, useProductList } from "../../shared/productLists";
import { feedQueryKey } from "../feed/FeedPage";
import {
  CATALOG_PAGE_SIZE,
  filterPanelReducer,
  hasMore,
  nextVisibleCount,
} from "./catalog";
import { CatalogTile, CatalogTileSkeleton } from "./CatalogTile";
import { FilterPanel } from "./FilterPanel";
import styles from "./CatalogPage.module.css";

const PANEL_ID = "catalog-filters";
/** Below --bp-desktop (1024px) the filter panel is a drawer over the page. */
const DRAWER_QUERY = "(max-width: 1023px)";

/**
 * Home page (/): banner to the swipe feed and the catalogue of all published products
 * (GET /api/feed — brand-made and imported cards). Works anonymously, no forms (BR-03).
 */
export function CatalogPage() {
  // Same query as the swipe feed: one request, one cache.
  const feed = useQuery({ queryKey: feedQueryKey, queryFn: getFeed });
  const items = feed.data?.items ?? [];
  const [visible, setVisible] = useState(CATALOG_PAGE_SIZE);
  const shown = items.slice(0, visible);

  const favorites = useProductList(favoriteList);
  const favoriteIds = useMemo(
    () => new Set(favorites.map((item) => item.id)),
    [favorites],
  );

  const [filtersOpen, dispatch] = useReducer(filterPanelReducer, false);
  const isDrawer = useMediaQuery(DRAWER_QUERY);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const closeFilters = useCallback(() => {
    dispatch({ type: "close" });
    toggleRef.current?.focus();
  }, []);

  // Escape closes the panel wherever the focus is.
  useEffect(() => {
    if (!filtersOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      dispatch({ type: "key", key: event.key });
      toggleRef.current?.focus();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [filtersOpen]);

  return (
    <div className={styles.page}>
      <Link to="/feed" className={styles.banner}>
        <h1 className={styles.bannerTitle}>{t.bannerTitle}</h1>
        <p className={styles.bannerSubtitle}>{t.bannerSubtitle}</p>
        <span className={styles.bannerCta}>{t.bannerCta}</span>
      </Link>

      <div className={styles.toolbar}>
        <button
          ref={toggleRef}
          type="button"
          className={styles.filtersButton}
          aria-expanded={filtersOpen}
          aria-controls={PANEL_ID}
          onClick={() => dispatch({ type: "toggle" })}
        >
          <FiltersIcon />
          {t.filters}
        </button>
        <h2 className={styles.title}>
          {t.title}
          {feed.isSuccess && (
            <span className={styles.count}>{t.count(items.length)}</span>
          )}
        </h2>
      </div>

      <div className={styles.catalog} data-filters-open={filtersOpen}>
        {filtersOpen && (
          <FilterPanel
            id={PANEL_ID}
            isDrawer={isDrawer}
            onClose={closeFilters}
          />
        )}

        <section className={styles.results} aria-label={t.listLabel}>
          {feed.isPending && (
            <>
              <p className={styles.visuallyHidden} role="status">
                {t.loading}
              </p>
              <div className={styles.grid}>
                {Array.from({ length: 8 }, (_, index) => (
                  <CatalogTileSkeleton key={index} />
                ))}
              </div>
            </>
          )}

          {feed.isError && (
            <div className={styles.message}>
              <p role="alert" className={styles.messageText}>
                {t.error}
              </p>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => void feed.refetch()}
              >
                {t.retry}
              </button>
            </div>
          )}

          {feed.isSuccess && items.length === 0 && (
            <p className={`${styles.message} ${styles.messageText}`}>
              {t.empty}
            </p>
          )}

          {shown.length > 0 && (
            <ul className={styles.grid}>
              {shown.map((card) => (
                <li key={card.id}>
                  <CatalogTile
                    card={card}
                    isFavorite={favoriteIds.has(card.id)}
                  />
                </li>
              ))}
            </ul>
          )}

          {hasMore(visible, items.length) && (
            <div className={styles.more}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() =>
                  setVisible((count) => nextVisibleCount(count, items.length))
                }
              >
                {t.showMore}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/** True while the media query matches; follows window resizes. */
function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
