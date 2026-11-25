import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { getFeed } from "../../api/client";
import type { FeedCard } from "../../api/types";
import { FiltersIcon } from "../../shared/icons";
import { catalogTexts as t } from "../../shared/messages.uk";
import { favoriteList, useProductList } from "../../shared/productLists";
import { feedQueryKey } from "../feed/FeedPage";
import {
  brandOptions,
  CATALOG_PAGE_SIZE,
  sizeOptions,
  withSelectedSizes,
  filterCatalog,
  filterChips,
  filterPanelReducer,
  hasMore,
  isSingleBrandView,
  nextVisibleCount,
  parseFilters,
  priceRangeOf,
  type FilterChip,
  type PriceRange,
} from "./catalog";
import { FilterChips, RestoreFiltersButton } from "./FilterChips";
import { restoreLabel } from "./filterState";
import { useCatalogFilters } from "./useCatalogFilters";
import { BrandTiles } from "./BrandTiles";
import { showBrandTiles } from "./brandGrid";
import { CatalogTile, CatalogTileSkeleton } from "./CatalogTile";
import { FilterPanel } from "./FilterPanel";
import { HeroBanner } from "./HeroBanner";
import { revealDelay, useReveal } from "../../shared/reveal";
import { useMediaQuery } from "../../shared/useMediaQuery";
import styles from "./CatalogPage.module.css";

const PANEL_ID = "catalog-filters";
/** Below --bp-desktop (1024px) the filter panel is a drawer over the page. */
const DRAWER_QUERY = "(max-width: 1023px)";
const NO_ITEMS: readonly FeedCard[] = [];

/**
 * Home page (/): banner to the swipe feed and the catalogue of all published products
 * (GET /api/feed — brand-made and imported cards). Works anonymously, no forms (BR-03).
 * The filters live in the URL (?minPrice=A&maxPrice=B&brand=<key>…) and are applied on the
 * client: brands OR among themselves, AND with the price range.
 */
export function CatalogPage() {
  // Same query as the swipe feed: one request, one cache.
  const feed = useQuery({ queryKey: feedQueryKey, queryFn: getFeed });
  const allItems = feed.data?.items ?? NO_ITEMS;

  const options = useMemo(() => brandOptions(allItems), [allItems]);
  const sizes = useMemo(() => sizeOptions(allItems), [allItems]);
  // Unknown brands in the URL are ignored once the catalogue is known.
  const knownBrands = useMemo(
    () => (feed.isSuccess ? new Set(options.map((o) => o.key)) : null),
    [feed.isSuccess, options],
  );
  // Unknown sizes in the URL are ignored once the catalogue is known.
  const knownSizes = useMemo(
    () => (feed.isSuccess ? new Set(sizes.map((o) => o.key)) : null),
    [feed.isSuccess, sizes],
  );
  const scrollToList = useRef(false);
  // «Знайдено N товарів» is announced only after the buyer changes a filter.
  const [announce, setAnnounce] = useState(false);
  /** Every filter change: list from its start (when asked), announced. */
  const onFiltersChange = useCallback((scroll: boolean) => {
    scrollToList.current = scroll;
    setAnnounce(true);
  }, []);
  // The filters of / and /feed: the same hook, the same URL parameters (useCatalogFilters).
  const [searchParamsForView] = useSearchParams();
  // «Сторінка бренду»: exactly one brand, no other filter. It is decided before unknown
  // brands are dropped, so a brand that has no products shows its own empty page.
  const brandView = brandViewKey(searchParamsForView);
  const {
    filters,
    filterKey,
    activeCount,
    toRestore,
    toggleBrand,
    toggleSize,
    applyPrice: applyPriceRange,
    resetPrice,
    removeChip,
    resetAll,
    restore,
  } = useCatalogFilters({
    knownBrands,
    knownSizes,
    remember: brandView === null,
    onChange: onFiltersChange,
  });
  const items = useMemo(
    () => filterCatalog(allItems, filters),
    // filterKey stands for the filters object, which is new on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allItems, filterKey],
  );
  const brandLabel =
    brandView === null
      ? undefined
      : options.find((option) => option.key === brandView)?.label;

  // «Показати ще» counts within the filtered list; a filter change starts on the first page.
  const [paging, setPaging] = useState({
    filterKey,
    visible: CATALOG_PAGE_SIZE,
  });
  const visible =
    paging.filterKey === filterKey ? paging.visible : CATALOG_PAGE_SIZE;
  const showMore = () =>
    setPaging({ filterKey, visible: nextVisibleCount(visible, items.length) });

  const favorites = useProductList(favoriteList);
  const favoriteIds = useMemo(
    () => new Set(favorites.map((item) => item.id)),
    [favorites],
  );

  const [filtersOpen, dispatch] = useReducer(filterPanelReducer, false);
  const isDrawer = useMediaQuery(DRAWER_QUERY);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  // The toolbar both rises into place (reveal) and is the scroll target after a filter change.
  const revealToolbar = useReveal<HTMLDivElement>(revealDelay.toolbar);
  const toolbarRefCallback = useCallback(
    (element: HTMLDivElement | null) => {
      toolbarRef.current = element;
      return revealToolbar(element);
    },
    [revealToolbar],
  );
  const catalogRef = useRef<HTMLDivElement>(null);

  const closeFilters = useCallback(() => {
    dispatch({ type: "close" });
    toggleRef.current?.focus();
  }, []);

  /** «Показати …» of the price group: the drawer closes, the laptop column stays. */
  const applyPrice = useCallback(
    (range: PriceRange) => {
      if (!applyPriceRange(range, isDrawer)) dispatch({ type: "close" });
      toggleRef.current?.focus({ preventScroll: true });
    },
    [applyPriceRange, isDrawer],
  );

  // After a filter change from the panel the list starts at the top of the screen.
  useEffect(() => {
    if (!scrollToList.current) return;
    scrollToList.current = false;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    // With the laptop column open, its row goes to the top: the sticky panel then fits the
    // window, «Показати N товарів» included. Otherwise the toolbar with the count does.
    const target = filtersOpen && !isDrawer ? catalogRef : toolbarRef;
    target.current?.scrollIntoView({
      block: "start",
      behavior: reduce ? "auto" : "smooth",
    });
    // Only a filter change scrolls; the panel state is read, not watched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  // «MINT — FULLA» on a brand page; the previous title comes back when it is left.
  useEffect(() => {
    if (brandLabel === undefined) return;
    const previous = document.title;
    document.title = t.brandPageTitle(brandLabel);
    return () => {
      document.title = previous;
    };
  }, [brandLabel]);

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

  // A new <p> per filter state, so the same count is announced again after another change.
  // While the drawer (a modal dialog) is open, the region lives inside it.
  const announcement = (
    <div className={styles.visuallyHidden} aria-live="polite">
      {announce && feed.isSuccess && (
        <p key={filterKey}>{t.found(items.length)}</p>
      )}
    </div>
  );
  const announceInPanel = filtersOpen && isDrawer;

  return (
    <div className={styles.page}>
      {brandView === null ? (
        <HeroBanner />
      ) : (
        <BrandHeader
          label={brandLabel}
          count={feed.isSuccess ? items.length : null}
        />
      )}

      {showBrandTiles({
        status: feed.status,
        activeFilters: activeCount,
        singleBrandView: brandView !== null,
        brandCount: options.length,
      }) && <BrandTiles options={feed.isPending ? null : options} />}

      <div ref={toolbarRefCallback} className={styles.toolbar}>
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
          {activeCount > 0 && (
            <>
              <span className={styles.filtersBadge} aria-hidden="true">
                {activeCount}
              </span>
              <span className={styles.visuallyHidden}>
                {`, ${t.activeFilters(activeCount)}`}
              </span>
            </>
          )}
        </button>
        {brandView === null && (
          <h2 className={styles.title}>
            {t.title}
            {feed.isSuccess && (
              <span className={styles.count}>{t.count(items.length)}</span>
            )}
          </h2>
        )}
      </div>
      {!announceInPanel && announcement}
      {toRestore !== null && feed.isSuccess && (
        <RestoreFiltersButton
          label={restoreLabel(toRestore, options)}
          onRestore={restore}
        />
      )}

      <div
        ref={catalogRef}
        className={styles.catalog}
        data-filters-open={filtersOpen}
      >
        {filtersOpen && (
          <FilterPanel
            id={PANEL_ID}
            isDrawer={isDrawer}
            onClose={closeFilters}
            appliedPrice={priceRangeOf(filters)}
            onApplyPrice={applyPrice}
            onResetPrice={resetPrice}
            brandOptions={feed.isPending ? null : options}
            selectedBrands={filters.brands}
            onToggleBrand={toggleBrand}
            sizeOptions={
              feed.isPending ? null : withSelectedSizes(sizes, filters.sizes)
            }
            selectedSizes={filters.sizes}
            onToggleSize={toggleSize}
            activeCount={activeCount}
            onResetAll={resetAll}
            resultCount={items.length}
            announcement={announceInPanel ? announcement : null}
          />
        )}

        <CatalogResults
          status={feed.status}
          items={items}
          visible={visible}
          // The brand page's heading already names its brand: no chip for it.
          chips={
            feed.isSuccess && brandView === null
              ? filterChips(filters, options)
              : []
          }
          emptyText={brandView === null ? undefined : t.brandPageEmpty}
          favoriteIds={favoriteIds}
          onRetry={() => void feed.refetch()}
          onShowMore={showMore}
          onRemoveChip={removeChip}
          onResetAll={resetAll}
        />
      </div>
    </div>
  );
}

/** The brand key of a «Сторінка бренду» URL, or null for the ordinary catalogue. */
function brandViewKey(params: URLSearchParams): string | null {
  const raw = parseFilters(params);
  return isSingleBrandView(raw) ? (raw.brands[0] ?? null) : null;
}

interface BrandHeaderProps {
  /** Brand name as the catalogue spells it; undefined while loading or for an unknown brand. */
  label: string | undefined;
  /** Products of the brand; null while loading. */
  count: number | null;
}

/** Top of a brand page: «← Весь одяг», the small «Бренд», the name as h1 and the count. */
export function BrandHeader({ label, count }: BrandHeaderProps) {
  return (
    <header className={styles.brandHeader}>
      <Link
        to="/"
        className={styles.backLink}
        onClick={() => window.scrollTo({ top: 0 })}
      >
        <span aria-hidden="true">←</span> {t.backToAll}
      </Link>
      {label !== undefined && (
        <>
          <p className={styles.brandKicker}>{t.brandPageKicker}</p>
          <div className={styles.brandTitleRow}>
            <h1 className={styles.brandTitle}>{label}</h1>
            {count !== null && (
              <span className={styles.count}>{t.count(count)}</span>
            )}
          </div>
        </>
      )}
    </header>
  );
}

interface CatalogResultsProps {
  status: "pending" | "error" | "success";
  /** Already filtered. */
  items: readonly FeedCard[];
  visible: number;
  /** Active filters: one chip per brand, one for the price range. */
  chips: readonly FilterChip[];
  favoriteIds: ReadonlySet<string>;
  onRetry: () => void;
  onShowMore: () => void;
  /** ✕ of a chip: removes only that filter. */
  onRemoveChip: (chipId: string) => void;
  onResetAll: () => void;
  /** Empty result without chips (the brand page): this text instead of «Товарів поки немає». */
  emptyText?: string;
}

/** Hook-free list part of the page: filter chips, grid, empty states, «Показати ще». */
export function CatalogResults({
  status,
  items,
  visible,
  chips,
  favoriteIds,
  onRetry,
  onShowMore,
  onRemoveChip,
  onResetAll,
  emptyText = t.empty,
}: CatalogResultsProps) {
  const shown = items.slice(0, visible);
  const filtered = chips.length > 0;

  return (
    <section className={styles.results} aria-label={t.listLabel}>
      {status === "pending" && (
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

      {status === "error" && (
        <div className={styles.message}>
          <p role="alert" className={styles.messageText}>
            {t.error}
          </p>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onRetry}
          >
            {t.retry}
          </button>
        </div>
      )}

      {status === "success" && (
        <FilterChips
          chips={chips}
          onRemove={onRemoveChip}
          onResetAll={onResetAll}
        />
      )}

      {status === "success" && items.length === 0 && !filtered && (
        <p className={`${styles.message} ${styles.messageText}`}>{emptyText}</p>
      )}

      {status === "success" && items.length === 0 && filtered && (
        <div className={styles.message}>
          <p className={styles.messageText}>{t.emptyFiltered}</p>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onResetAll}
          >
            {t.resetAll}
          </button>
        </div>
      )}

      {shown.length > 0 && (
        <ul className={styles.grid}>
          {shown.map((card, index) => (
            <li key={card.id}>
              <CatalogTile
                card={card}
                isFavorite={favoriteIds.has(card.id)}
                index={index}
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
            onClick={onShowMore}
          >
            {t.showMore}
          </button>
        </div>
      )}
    </section>
  );
}
