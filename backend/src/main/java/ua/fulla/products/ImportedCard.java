package ua.fulla.products;

import java.util.List;
import java.util.UUID;

/**
 * A card from the dev-only demo import (ADR-0014), already cleaned by the importer:
 * name ≤ 100 chars, price 1…1 000 000 UAH, {@code https://} photo URL, plain-text description.
 * {@code available = false} keeps (or puts) the card in Draft (T-15).
 */
public record ImportedCard(
        UUID sourceId,
        UUID sourceBrandId,
        String externalId,
        String name,
        int priceUah,
        String photoUrl,
        String productUrl,
        boolean available,
        List<ProductSize> sizes,
        List<ProductColor> colors,
        String material,
        String description) {}
