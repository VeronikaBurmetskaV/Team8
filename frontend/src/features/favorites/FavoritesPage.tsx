import { favoritesTexts as t } from "../../shared/messages.uk";
import { favoriteLists, useProductList } from "../../shared/productLists";
import { SavedProducts } from "../../shared/SavedProducts/SavedProducts";

/**
 * «Вподобане» (/favorites): only products the buyer added explicitly with «Додати у Вподобане».
 * A swipe in the feed does NOT add here. Stored in this browser only.
 */
export function FavoritesPage() {
  const items = useProductList(favoriteLists.favorites);

  return (
    <SavedProducts
      titleId="favorites-title"
      title={t.title}
      items={items}
      emptyText={t.empty}
      emptyLinkTo="/swipe-favorites"
      emptyLinkText={t.toSwipeFavorites}
      listLabel={t.listLabel}
      removeLabel={t.removeLabel}
      onRemove={(id) => favoriteLists.favorites.remove(id)}
    />
  );
}
