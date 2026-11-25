package ua.fulla.catalogimport;

import java.util.List;
import java.util.Set;

/**
 * What one run read from a source. {@code complete} is false when some pages failed or the
 * source stopped us midway: then items missing from the batch are NOT hidden (T-16).
 *
 * <p>The brand site import (ADR-0017) also fills: {@code listedIds}, the external IDs of every
 * product the site lists (also beyond the item cap; only meaningful when {@code complete});
 * {@code method} ({@code feed}, {@code shopify}, {@code sitemap}, or null when nothing worked);
 * {@code sourceUrl}, where the items were read (null = each item's own product page); and
 * {@code skipped}, products read but not imported (not clothing, another currency, invalid).
 */
record ImportBatch(List<ImportedItem> items, boolean complete, Set<String> listedIds, String method,
        String sourceUrl, int skipped) {

    ImportBatch {
        items = List.copyOf(items);
        listedIds = Set.copyOf(listedIds);
    }

    ImportBatch(List<ImportedItem> items, boolean complete) {
        this(items, complete, Set.of(), null, null, 0);
    }
}
