package ua.fulla.catalogimport;

import java.util.List;

/**
 * What one run read from a source. {@code complete} is false when some pages failed or the
 * source stopped us midway: then items missing from the batch are NOT hidden (T-16).
 */
record ImportBatch(List<ImportedItem> items, boolean complete) {

    ImportBatch {
        items = List.copyOf(items);
    }
}
