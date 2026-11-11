package ua.fulla.brandauth;

import java.time.Instant;
import java.util.UUID;

/** A row of {@code brand_accounts} (data-model.md §2.1). */
record BrandAccount(UUID id, String email, String passwordHash, Instant createdAt) {}
