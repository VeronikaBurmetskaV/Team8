import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { getFeed } from "../../api/client";
import type { FeedCard } from "../../api/types";
import { errorMessage } from "../../shared/errors";
import {
  CartIcon,
  CloseIcon,
  FiltersIcon,
  HeartIcon,
  QuestionIcon,
} from "../../shared/icons";
import { catalogTexts as ct, feedTexts as t } from "../../shared/messages.uk";
import { ProductCard } from "../../shared/ProductCard/ProductCard";
import {
  showFavoritesLimit,
  useFavoritesLimit,
} from "../../shared/favoritesLimit";
import { addToFavorites, favoriteList } from "../../shared/productLists";
import { addToCart } from "../cart/cart";
import {
  brandOptions,
  filterCatalog,
  filterChips,
  filterPanelReducer,
  filtersKey,
  priceRangeOf,
  sizeOptions,
  withSelectedSizes,
  type PriceRange,
} from "../catalog/catalog";
import { FilterChips, RestoreFiltersButton } from "../catalog/FilterChips";
import { FilterPanel } from "../catalog/FilterPanel";
import { restoreLabel, withFilters } from "../catalog/filterState";
import { useCatalogFilters } from "../catalog/useCatalogFilters";
import catalogStyles from "../catalog/CatalogPage.module.css";
import { demoPictureNumber, withDemoFallback } from "./demoFeed";
import { HintDialog } from "./HintDialog";
import { feedCommandForKey } from "./keyboard";
import {
  currentCard,
  emptyProgress,
  feedBrandOptions,
  feedEndState,
  feedReducer,
  filteredQueue,
  pendingCards,
  swipeOutcome,
} from "./queue";
import { SwipeCard, type SwipeDirection } from "./SwipeCard";
import styles from "./FeedPage.module.css";

export const feedQueryKey = ["feed"] as const;

const TOAST_MS = 2000;
const PANEL_ID = "feed-filters";

/**
 * Swipe feed (US-08.1, US-08.2, US-09, US-10). Works anonymously, no forms in front (BR-03).
 * Filtered by the catalogue's filters (the same URL parameters, panel and chips as on /):
 * the queue is the unviewed cards that pass them; progress survives every filter change.
 */
export function FeedPage() {
  const feed = useQuery({ queryKey: feedQueryKey, queryFn: getFeed });
  const { items, isDemo } = useMemo(
    () => withDemoFallback(feed.data?.items, feed.isError, import.meta.env.DEV),
    [feed.data, feed.isError],
  );

  const [progress, dispatch] = useReducer(feedReducer, emptyProgress);
  const { limit: favoritesLimit } = useFavoritesLimit();

  // ---- Filters: the catalogue's, shared through the URL ----
  const allOptions = useMemo(() => brandOptions(items), [items]);
  const knownBrands = useMemo(
    () => (feed.isPending ? null : new Set(allOptions.map((o) => o.key))),
    [feed.isPending, allOptions],
  );
  // Sizes of the whole catalogue (viewed cards too): a chosen size is not "unknown" just
  // because its cards were all swiped already.
  const knownSizes = useMemo(
    () =>
      feed.isPending ? null : new Set(sizeOptions(items).map((o) => o.key)),
    [feed.isPending, items],
  );
  // «Залишилось N карток» is announced only after the buyer changes a filter.
  const [announce, setAnnounce] = useState(false);
  const onFiltersChange = useCallback(() => setAnnounce(true), []);
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
    remember: true,
    onChange: onFiltersChange,
  });
  const [filtersOpen, dispatchPanel] = useReducer(filterPanelReducer, false);
  const filtersRef = useRef<HTMLButtonElement>(null);

  /** The card that was just decided and is flying off; the next one is already under it. */
  const [flying, setFlying] = useState<{
    card: FeedCard;
    direction: SwipeDirection;
  } | null>(null);

  // The queue follows the filters, but never while a card is flying off: the new queue
  // takes over once its animation has ended (state adjusted during render).
  const [queueFilters, setQueueFilters] = useState(filters);
  if (flying === null && filtersKey(queueFilters) !== filterKey) {
    setQueueFilters(filters);
  }
  const pendingAll = pendingCards(items, progress);
  const queueItems = useMemo(
    () => filterCatalog(items, queueFilters),
    [items, queueFilters],
  );
  const pending = pendingCards(queueItems, progress);
  const current = currentCard(queueItems, progress);
  /** Unviewed cards under the filters as they are now: the drawer's «Показати N товарів». */
  const resultCount = filteredQueue(items, filters, progress).length;
  const [flipped, setFlipped] = useState(false);
  const [toastId, setToastId] = useState(0);
  // Opens only by the «?» button, never on its own.
  const [hintOpen, setHintOpen] = useState(false);

  useEffect(() => {
    if (toastId === 0) return;
    const timer = window.setTimeout(() => setToastId(0), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toastId]);

  /** Like or skip of the current card: swipe, buttons and keys all end here (BR-11). */
  const decide = useCallback(
    (direction: SwipeDirection): boolean => {
      // While a card is flying off nothing else is accepted (US-10 S2); the reducer also
      // ignores a second decision for the same ID.
      if (flying !== null || current === null) return false;
      // «Вподобане» full: the like is refused, the card stays (it snaps back) and the dialog
      // explains why; a skip always works.
      const outcome = swipeOutcome(
        progress,
        favoriteList.read(),
        current.id,
        direction,
        favoritesLimit,
      );
      if (outcome.blocked) {
        showFavoritesLimit();
        return false;
      }
      dispatch({
        type: direction === "right" ? "like" : "skip",
        id: current.id,
      });
      // A like (swipe right or «Сподобалось») goes to the one «Вподобане» (localStorage).
      if (direction === "right")
        addToFavorites(current, favoriteList, favoritesLimit);
      setFlying({ card: current, direction });
      return true;
    },
    [current, flying, progress, favoritesLimit],
  );

  const handleExited = useCallback(() => {
    setFlying(null);
    setFlipped(false);
  }, [setFlipped]);

  const handleAddToCart = useCallback(() => {
    if (current === null || flying !== null) return;
    addToCart(current);
    setToastId((id) => id + 1);
  }, [current, flying]);

  // Keyboard: ← not today, → like, space flips. Latest handlers via a ref.
  const keyHandlers = useRef({
    decide,
    flip: () => setFlipped((value) => !value),
  });
  useEffect(() => {
    keyHandlers.current = { decide, flip: () => setFlipped((value) => !value) };
  });
  const canAct =
    current !== null && flying === null && !hintOpen && !filtersOpen;
  useEffect(() => {
    if (!canAct) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const command = feedCommandForKey({
        key: event.key,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        targetTag: target?.tagName,
        targetEditable: target?.isContentEditable,
      });
      if (command === null) return;
      event.preventDefault();
      if (command === "flip") keyHandlers.current.flip();
      else keyHandlers.current.decide(command === "like" ? "right" : "left");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canAct]);

  /** ✕, Escape, the backdrop or «Показати N товарів»: the focus returns to «Фільтри». */
  const closeFilters = useCallback(() => {
    dispatchPanel({ type: "close" });
    filtersRef.current?.focus();
  }, []);

  /** «Показати …» of the price group applies and closes the drawer. */
  const applyPrice = useCallback(
    (range: PriceRange) => {
      if (!applyPriceRange(range, true)) closeFilters();
    },
    [applyPriceRange, closeFilters],
  );

  // Escape closes the drawer wherever the focus is.
  useEffect(() => {
    if (!filtersOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      dispatchPanel({ type: "key", key: event.key });
      filtersRef.current?.focus();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [filtersOpen]);

  const loaded = !feed.isPending && !(feed.isError && !isDemo);
  const chips = loaded ? filterChips(filters, allOptions) : [];
  // A new <p> per filter state, so the same number is announced again after another change.
  // While the drawer (a modal dialog) is open, the region lives inside it.
  const announcement = (
    <div className={catalogStyles.visuallyHidden} aria-live="polite">
      {announce && loaded && <p key={filterKey}>{t.cardsLeft(resultCount)}</p>}
    </div>
  );

  // Top of the deck: the flying card, else the current one. Under it: the next card.
  const top = flying?.card ?? current;
  const under = flying !== null ? current : (pending[1] ?? null);
  const actionsDisabled = current === null || flying !== null;

  /** Demo cards show a grey «Картинка N» stub; real cards keep their photo. */
  const photoStub = (card: FeedCard): string | undefined => {
    if (!isDemo) return undefined;
    const number = demoPictureNumber(card.id);
    return number === null ? undefined : t.demoPicture(number);
  };

  let content;
  if (feed.isPending) {
    content = <p className={styles.status}>{t.loading}</p>;
  } else if (feed.isError && !isDemo) {
    content = (
      <div className={styles.status}>
        <p role="alert">{errorMessage(feed.error)}</p>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => feed.refetch()}
        >
          {t.retry}
        </button>
      </div>
    );
  } else if (
    top === null &&
    feedEndState(pendingAll.length, pending.length, activeCount) === "filtered"
  ) {
    // Unviewed cards exist, but none passes the filters.
    content = (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>{t.filtersEmpty}</p>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={resetAll}
        >
          {t.resetFilters}
        </button>
        <Link to={withFilters("/", filters)} className={styles.primaryLink}>
          {t.toCatalog}
        </Link>
      </div>
    );
  } else if (top === null) {
    // Everything viewed, or no published cards at all (US-08.1 S2, CL).
    content = (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>{t.allViewed}</p>
        <Link to="/favorites" className={styles.primaryLink}>
          {t.toFavorites}
        </Link>
      </div>
    );
  } else {
    content = (
      <div className={styles.stage}>
        <div className={styles.deck} role="region" aria-label={t.cardRegion}>
          {under !== null && (
            <div
              key={under.id}
              className={styles.underCard}
              aria-hidden="true"
              inert
            >
              <ProductCard
                card={under}
                flipped={false}
                photoStub={photoStub(under)}
              />
            </div>
          )}
          <SwipeCard
            key={top.id}
            card={top}
            exit={flying?.direction ?? null}
            onSwipe={decide}
            onExited={handleExited}
            flipped={flipped}
            onFlippedChange={setFlipped}
            photoStub={photoStub(top)}
            backAction={
              // On the back side with the details; the cart logic is unchanged.
              <button
                type="button"
                className={styles.cartButton}
                aria-label={t.toCartLabel}
                disabled={actionsDisabled}
                onClick={handleAddToCart}
              >
                <CartIcon className={styles.cartIcon} />
                {t.toCart}
              </button>
            }
          />
        </div>

        {/* Beside the card where there is room, under it on a phone and tablet.
            «Не сьогодні» left, «Сподобалось» right — the same sides as the swipes. */}
        <button
          type="button"
          className={`${styles.actionButton} ${styles.skipButton}`}
          aria-label={t.skipLabel}
          disabled={actionsDisabled}
          onClick={() => decide("left")}
        >
          <span className={styles.actionCircle}>
            <CloseIcon className={styles.actionIcon} />
          </span>
          <span className={styles.actionText}>{t.skip}</span>
        </button>
        <button
          type="button"
          className={`${styles.actionButton} ${styles.likeButton}`}
          aria-label={t.likeLabel}
          disabled={actionsDisabled}
          onClick={() => decide("right")}
        >
          <span className={styles.actionCircle}>
            <HeartIcon className={styles.actionIcon} />
          </span>
          <span className={styles.actionText}>{t.like}</span>
        </button>

        {/* Brand page is US-20 (Post-MVP): a placeholder without a link for now. */}
        <p className={styles.brandLink}>
          <span aria-disabled="true" title={t.soon}>
            {t.brandAll(top.brandName)}
          </span>
          <span className={styles.soonBadge}>{t.soon}</span>
        </p>
      </div>
    );
  }

  return (
    <section
      className={styles.page}
      aria-labelledby="feed-title"
      data-has-filter-row={chips.length > 0 || (toRestore !== null && loaded)}
    >
      <div className={styles.topBar}>
        <h1 id="feed-title" className={styles.visuallyHidden}>
          {t.title}
        </h1>
        {/* The catalogue's «Фільтри»: over the card, never on it. */}
        <button
          ref={filtersRef}
          type="button"
          className={`${catalogStyles.filtersButton} ${styles.filtersButton}`}
          aria-expanded={filtersOpen}
          aria-controls={PANEL_ID}
          onClick={() => dispatchPanel({ type: "toggle" })}
        >
          <FiltersIcon />
          {ct.filters}
          {activeCount > 0 && (
            <>
              <span className={catalogStyles.filtersBadge} aria-hidden="true">
                {activeCount}
              </span>
              <span className={catalogStyles.visuallyHidden}>
                {`, ${ct.activeFilters(activeCount)}`}
              </span>
            </>
          )}
        </button>
        <span className={styles.hintWrap}>
          <button
            type="button"
            className={styles.hintButton}
            aria-label={t.hintOpen}
            aria-haspopup="dialog"
            onClick={() => setHintOpen(true)}
          >
            <QuestionIcon />
          </button>
          {/* Shown on hover and on keyboard focus; the button already has the same aria-label. */}
          <span className={styles.hintTooltip} aria-hidden="true">
            {t.hintOpen}
          </span>
        </span>
      </div>

      {(chips.length > 0 || (toRestore !== null && loaded)) && (
        <div className={styles.filterRow}>
          <FilterChips
            chips={chips}
            onRemove={removeChip}
            onResetAll={resetAll}
          />
          {toRestore !== null && loaded && (
            <RestoreFiltersButton
              label={restoreLabel(toRestore, allOptions)}
              onRestore={restore}
            />
          )}
        </div>
      )}
      {!filtersOpen && announcement}

      {content}

      {filtersOpen && (
        <FilterPanel
          id={PANEL_ID}
          // No side column on /feed: a drawer over the page on every size.
          isDrawer
          onClose={closeFilters}
          appliedPrice={priceRangeOf(filters)}
          onApplyPrice={applyPrice}
          onResetPrice={resetPrice}
          brandOptions={
            feed.isPending
              ? null
              : feedBrandOptions(pendingAll, allOptions, filters.brands)
          }
          selectedBrands={filters.brands}
          onToggleBrand={toggleBrand}
          // Like the brands: counted over the unviewed cards.
          sizeOptions={
            feed.isPending
              ? null
              : withSelectedSizes(sizeOptions(pendingAll), filters.sizes)
          }
          selectedSizes={filters.sizes}
          onToggleSize={toggleSize}
          activeCount={activeCount}
          onResetAll={resetAll}
          resultCount={resultCount}
          announcement={announcement}
        />
      )}

      <p className={styles.toast} role="status" data-visible={toastId !== 0}>
        {toastId !== 0 ? t.addedToCart : ""}
      </p>

      <HintDialog open={hintOpen} onClose={() => setHintOpen(false)} />
    </section>
  );
}
