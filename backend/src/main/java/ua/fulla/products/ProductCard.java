package ua.fulla.products;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * A row of {@code products} (data-model.md §2.3) with the brand name joined from
 * {@code brand_profiles}: it is never stored on the card (INV-03).
 */
record ProductCard(
        UUID id,
        UUID brandId,
        String name,
        String brandName,
        int priceUah,
        UUID photoImageId,
        String photoUrl,
        String productUrl,
        ProductStatus status,
        Instant publishedAt,
        Instant createdAt,
        Instant updatedAt,
        /** Where the brand-site import read the card (ADR-0017); null for a hand-made card. */
        String sourceUrl,
        /** Fields of an imported card the brand edited by hand (DB names); empty otherwise. */
        List<String> editedFields,
        /**
         * Since when a complete import no longer lists the card («Немає на сайті», ADR-0017); null
         * while the site lists it. Such a card is always a Draft and can't be published.
         */
        Instant missingSince) {

    boolean notOnSite() {
        return missingSince != null;
    }
}
