package ua.fulla.catalogimport;

import java.io.IOException;
import java.net.URI;

/**
 * One source adapter of the demo import (ADR-0014; the only interface besides {@code ImageStore}).
 * Implementations only read and parse; storing goes through {@link CatalogSyncService}.
 */
interface CatalogImporter {

    /** {@code catalog_sources.code}: {@code vsisvoi}, {@code onebyone} or {@code cher17}. */
    String code();

    /** The source's {@code https://} origin; every fetched URL must have its host. */
    URI baseUrl();

    /**
     * Reads at most {@code maxProducts} products. robots.txt is already loaded into the fetcher.
     * Throws when the source can't be read at all (the run is then {@code failed}).
     */
    ImportBatch fetch(PoliteFetcher fetcher, int maxProducts) throws IOException;
}
