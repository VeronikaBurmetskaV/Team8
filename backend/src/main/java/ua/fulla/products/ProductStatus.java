package ua.fulla.products;

import java.util.Locale;

/** Card status (domain-model.md §4.2): lowercase in the database, UPPER_CASE in JSON. */
public enum ProductStatus {
    DRAFT,
    PUBLISHED;

    static ProductStatus fromColumn(String status) {
        return valueOf(status.toUpperCase(Locale.ROOT));
    }
}
