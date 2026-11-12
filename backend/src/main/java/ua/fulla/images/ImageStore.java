package ua.fulla.images;

import java.util.Optional;
import java.util.UUID;

/**
 * Where uploaded image bytes live (ADR-0007): Postgres {@code bytea} today, a CDN could be a
 * future swap. The one deliberate abstraction of the codebase (ADR-0001).
 * Unlike the sketch in ADR-0007, {@code save} also takes the uploading brand: {@code images.uploaded_by}
 * is NOT NULL and serves the ownership check (Q-03, T-8).
 */
interface ImageStore {

    /** Stores the bytes, already checked by {@link ImageService}, and returns the new image ID. */
    UUID save(UUID uploadedBy, String contentType, byte[] bytes);

    Optional<StoredImage> get(UUID id);

    /** T-8: whether the image exists and was uploaded by this brand; does not load the bytes. */
    boolean isOwnedBy(UUID id, UUID brandId);
}
