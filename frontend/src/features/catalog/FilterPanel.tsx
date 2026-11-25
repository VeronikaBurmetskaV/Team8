import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { CloseIcon } from "../../shared/icons";
import { catalogTexts as t } from "../../shared/messages.uk";
import {
  formatPriceRange,
  hasPriceRange,
  type BrandOption,
  type PriceRange,
  type SizeOption,
} from "./catalog";
import { SizeFilter } from "./SizeFilter";
import { BrandFilter } from "./BrandFilter";
import { FilterGroup } from "./FilterGroup";
import { PriceFilter } from "./PriceFilter";
import styles from "./CatalogPage.module.css";

interface FilterPanelProps {
  id: string;
  /**
   * A drawer over the page (catalogue below --bp-desktop, /feed on every size) or a column
   * beside the grid (catalogue on a laptop).
   */
  isDrawer: boolean;
  onClose: () => void;
  /** The price range applied in the URL (?minPrice=&maxPrice=). */
  appliedPrice: PriceRange;
  onApplyPrice: (range: PriceRange) => void;
  onResetPrice: () => void;
  /** Brands of the catalogue; null while loading. With none, the group is not shown. */
  brandOptions: readonly BrandOption[] | null;
  selectedBrands: readonly string[];
  onToggleBrand: (key: string) => void;
  /** Sizes in stock (sizeOptions); null while loading. */
  sizeOptions: readonly SizeOption[] | null;
  selectedSizes: readonly string[];
  onToggleSize: (key: string) => void;
  /** Active filters (each brand + price as one); «Скинути все» shows when above 0. */
  activeCount: number;
  onResetAll: () => void;
  /** Products that pass the filters now: the drawer's «Показати N товарів». */
  resultCount: number;
  /** «Знайдено N товарів» after a change; inside the dialog so screen readers hear it. */
  announcement: ReactNode;
}

/**
 * Filter groups of the catalogue, all collapsed behind «+» (a group with an active filter
 * opens expanded). «Ціна» and «Бренд» work on the client over the full list of GET /api/feed
 * (all published cards in one response), kept in the URL as ?minPrice=A&maxPrice=B and
 * ?brand=<key>&brand=<key2>; the backend and the API contract are unchanged. «Категорія
 * одягу» and «Розмір» are still placeholders that expand to «Скоро» (Out of Scope of the MVP,
 * US-04, US-05).
 */
export function FilterPanel({
  id,
  isDrawer,
  onClose,
  appliedPrice,
  onApplyPrice,
  onResetPrice,
  brandOptions,
  selectedBrands,
  onToggleBrand,
  sizeOptions,
  selectedSizes,
  onToggleSize,
  activeCount,
  onResetAll,
  resultCount,
  announcement,
}: FilterPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  // «Показати всі» in «Бренд» widens the panel; the panel unmounts on close, so the next
  // opening starts narrow again.
  const [brandsExpanded, setBrandsExpanded] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Keyboard users land in the panel when it opens.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // The drawer covers the page: the page behind it does not scroll.
  useEffect(() => {
    if (!isDrawer) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isDrawer]);

  /** In the drawer, Tab cycles inside the panel, so focus never goes behind the backdrop. */
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!isDrawer || event.key !== "Tab" || panelRef.current === null) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'button, input, [role="slider"]',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (first === undefined || last === undefined) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      {isDrawer && (
        <div className={styles.backdrop} aria-hidden="true" onClick={onClose} />
      )}
      <aside
        ref={panelRef}
        id={id}
        className={styles.panel}
        aria-labelledby={`${id}-title`}
        role={isDrawer ? "dialog" : undefined}
        aria-modal={isDrawer ? true : undefined}
        data-expanded={brandsExpanded}
        // CSS lays the panel out by this, not by the window: /feed keeps the drawer on a laptop.
        data-layout={isDrawer ? "drawer" : "column"}
        onKeyDown={onKeyDown}
      >
        <div className={styles.panelHeader}>
          <h2 id={`${id}-title`} className={styles.panelTitle}>
            {t.filters}
          </h2>
          {activeCount > 0 && (
            <button
              type="button"
              className={`${styles.textButton} ${styles.panelReset}`}
              onClick={onResetAll}
            >
              {t.resetAll}
            </button>
          )}
          <button
            ref={closeRef}
            type="button"
            className={styles.iconButton}
            aria-label={t.filtersClose}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
        {t.filterGroups.map((group, index) =>
          group === t.priceGroup ? (
            <FilterGroup
              key={group}
              id={`${id}-price`}
              title={group}
              summary={formatPriceRange(appliedPrice)}
              initialOpen={hasPriceRange(appliedPrice)}
            >
              <PriceFilter
                key={`${appliedPrice.min}-${appliedPrice.max}`}
                id={`${id}-price`}
                applied={appliedPrice}
                onApply={onApplyPrice}
                onReset={onResetPrice}
              />
            </FilterGroup>
          ) : group === t.brandGroup ? (
            brandOptions !== null && brandOptions.length === 0 ? null : (
              <FilterGroup
                key={group}
                id={`${id}-brand`}
                title={group}
                summary={
                  selectedBrands.length > 0
                    ? t.brandSelected(selectedBrands.length)
                    : undefined
                }
                initialOpen={selectedBrands.length > 0}
              >
                <BrandFilter
                  id={`${id}-brand`}
                  options={brandOptions}
                  selected={selectedBrands}
                  onToggle={onToggleBrand}
                  expanded={brandsExpanded}
                  onToggleExpanded={() => setBrandsExpanded((value) => !value)}
                />
              </FilterGroup>
            )
          ) : group === t.sizeGroup ? (
            <FilterGroup
              key={group}
              id={`${id}-size`}
              title={group}
              summary={
                selectedSizes.length > 0
                  ? t.brandSelected(selectedSizes.length)
                  : undefined
              }
              initialOpen={selectedSizes.length > 0}
            >
              <SizeFilter
                id={`${id}-size`}
                options={sizeOptions}
                selected={selectedSizes}
                onToggle={onToggleSize}
              />
            </FilterGroup>
          ) : (
            <FilterGroup key={group} id={`${id}-group-${index}`} title={group}>
              <p className={styles.groupSoon}>{t.soon}</p>
            </FilterGroup>
          ),
        )}
        {announcement}
        {/* Sticky at the bottom on every size; the groups scroll between it and the header. */}
        <div className={styles.panelFooter}>
          <button
            type="button"
            className={styles.showResultsButton}
            onClick={onClose}
          >
            {t.showResults(resultCount)}
          </button>
        </div>
      </aside>
    </>
  );
}
