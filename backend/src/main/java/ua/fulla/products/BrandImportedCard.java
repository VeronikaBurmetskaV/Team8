package ua.fulla.products;

import java.util.List;
import java.util.UUID;

/**
 * A card a brand imports from its own verified site (ADR-0017), already cleaned by the importer:
 * name ≤ 100 chars, price 1…1 000 000 UAH, {@code https://} photo URL, plain-text texts.
 * {@code externalId} is the product URL path (unique per brand); {@code sourceUrl} is where the
 * item was read (feed, {@code products.json} or the product page).
 */
public record BrandImportedCard(
        UUID brandId,
        String externalId,
        String sourceUrl,
        String name,
        int priceUah,
        String photoUrl,
        String productUrl,
        List<ProductSize> sizes,
        List<ProductColor> colors,
        String material,
        String description) {

    public BrandImportedCard {
        sizes = List.copyOf(sizes);
        colors = List.copyOf(colors);
    }

    /** What storing one imported item did. */
    public enum Result {
        CREATED,
        UPDATED,
        UNCHANGED,
        /** A new item that was not stored (sold out, or the brand name is missing). */
        NOT_CREATED
    }
}
