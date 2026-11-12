package ua.fulla.images;

import java.time.Instant;
import java.util.UUID;

/** A row of {@code images} (data-model.md §2.4). Never updated: a new image gets a new ID. */
record StoredImage(
        UUID id,
        UUID uploadedBy,
        String contentType,
        int sizeBytes,
        byte[] bytes,
        Instant createdAt) {}
