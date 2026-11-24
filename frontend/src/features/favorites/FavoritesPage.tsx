import { favoritesTexts as t } from "../../shared/messages.uk";
import { favoriteList, useProductList } from "../../shared/productLists";
import { SavedProducts } from "../../shared/SavedProducts/SavedProducts";

/**
 * «Вподобане» (/favorites): the one list of liked products — likes from the swipe feed and
 * hearts from the catalogue, each product once. Stored in this browser only.
 */
export function FavoritesPage() {
  const items = useProductList(favoriteList);

  return (
    <SavedProducts
      titleId="favorites-title"
      title={t.title}
      items={items}
      emptyText={t.empty}
      emptyLinks={[
        { to: "/feed", text: t.toFeed },
        { to: "/", text: t.toCatalog },
      ]}
      listLabel={t.listLabel}
      removeLabel={t.removeLabel}
      onRemove={(id) => favoriteList.remove(id)}
    />
  );
}
