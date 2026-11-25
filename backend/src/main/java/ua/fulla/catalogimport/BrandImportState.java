package ua.fulla.catalogimport;

import java.time.Instant;
import java.util.UUID;

/** A row of {@code brand_imports} (ADR-0017); {@code status} and {@code method} lowercase as stored. */
record BrandImportState(
        UUID brandId,
        String status,
        String method,
        Instant startedAt,
        Instant finishedAt,
        Instant lastSuccessAt,
        int found,
        int created,
        int updated,
        int skipped,
        int hidden,
        String errorCode) {

    static BrandImportState idle(UUID brandId) {
        return new BrandImportState(brandId, "idle", null, null, null, null, 0, 0, 0, 0, 0, null);
    }

    /** The counts of one finished run. */
    record Counts(int found, int created, int updated, int skipped, int hidden) {
        static final Counts NONE = new Counts(0, 0, 0, 0, 0);
    }
}
