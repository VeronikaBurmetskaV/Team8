package ua.fulla.feed;

/**
 * One brand of {@code GET /api/brands} (api.md §2.2, ADR-0015). {@code key} = the catalogue's
 * brand key; {@code logoUrl} is {@code /api/images/{id}}, an {@code https://} URL or null.
 */
record BrandSummary(String key, String name, String logoUrl, int productCount) {}
