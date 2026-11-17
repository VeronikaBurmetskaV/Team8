package ua.fulla.catalogimport;

import java.util.Locale;

/** {@code catalog_sources.last_run_status} (data-model.md §5.1): lowercase in the database. */
enum RunStatus {
    OK,
    PARTIAL,
    SKIPPED,
    FAILED;

    String column() {
        return name().toLowerCase(Locale.ROOT);
    }
}
