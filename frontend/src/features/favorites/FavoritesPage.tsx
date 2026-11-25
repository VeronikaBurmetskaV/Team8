import { favoritesTexts as t } from "../../shared/messages.uk";
import { useFavoritesLimit } from "../../shared/favoritesLimit";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getFeed } from "../../api/client";
import {
  favoriteList,
  useProductList,
  withCurrentDetails,
} from "../../shared/productLists";
import { withDemoFallback } from "../feed/demoFeed";
import { feedQueryKey } from "../feed/FeedPage";
import { SavedProducts } from "../../shared/SavedProducts/SavedProducts";

/**
 * «Вподобане» (/favorites): the one list of liked products — likes from the swipe feed and
 * hearts from the catalogue, each product once. Stored in this browser only; sizes and the
 * other details come from the feed, so the stock badge is current.
 */
export function FavoritesPage() {
  const saved = useProductList(favoriteList);
  // The same (cached) feed query as / and /feed: current sizes for the badge and the card.
  const feed = useQuery({ queryKey: feedQueryKey, queryFn: getFeed });
  const items = useMemo(
    () =>
      withCurrentDetails(
        saved,
        withDemoFallback(feed.data?.items, feed.isError, import.meta.env.DEV)
          .items,
      ),
    [saved, feed.data, feed.isError],
  );
  const { limit } = useFavoritesLimit();

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
      limit={limit}
    />
  );
}
