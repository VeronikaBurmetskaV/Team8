import { swipeFavoritesTexts as t } from "../../shared/messages.uk";
import {
  addToFavorites,
  favoriteLists,
  useProductList,
} from "../../shared/productLists";
import {
  SavedProducts,
  savedProductsButtonClass,
} from "../../shared/SavedProducts/SavedProducts";

/**
 * «Вподобане зі свайпів» (/swipe-favorites): every like from the swipe feed.
 * «Додати у Вподобане» copies a product to the general «Вподобане» list.
 */
export function SwipeFavoritesPage() {
  const items = useProductList(favoriteLists.swipeFavorites);
  const favorites = useProductList(favoriteLists.favorites);
  const favoriteIds = new Set(favorites.map((item) => item.id));

  return (
    <SavedProducts
      titleId="swipe-favorites-title"
      title={t.title}
      items={items}
      emptyText={t.empty}
      emptyLinkTo="/feed"
      emptyLinkText={t.toFeed}
      listLabel={t.listLabel}
      removeLabel={t.removeLabel}
      onRemove={(id) => favoriteLists.swipeFavorites.remove(id)}
      extraAction={(item) => {
        const added = favoriteIds.has(item.id);
        return (
          <button
            type="button"
            className={savedProductsButtonClass}
            disabled={added}
            aria-label={
              added
                ? t.alreadyInFavoritesLabel(item.name)
                : t.addLabel(item.name)
            }
            onClick={() => addToFavorites(item)}
          >
            {added ? t.alreadyInFavorites : t.add}
          </button>
        );
      }}
    />
  );
}
