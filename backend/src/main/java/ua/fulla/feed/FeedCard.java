package ua.fulla.feed;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import java.util.UUID;

/**
 * A card of {@code GET /api/feed}: {@code PublicCard} (api.md §2.2) plus the optional details of
 * imported cards (ADR-0014). The details are left out of the JSON when the card has none, which
 * is always the case for brand-made cards.
 */
record FeedCard(
        UUID id,
        String name,
        String brandName,
        int priceUah,
        String photoUrl,
        String productUrl,
        @JsonInclude(JsonInclude.Include.NON_EMPTY) List<Size> sizes,
        @JsonInclude(JsonInclude.Include.NON_EMPTY) List<Color> colors,
        @JsonInclude(JsonInclude.Include.NON_NULL) String material,
        @JsonInclude(JsonInclude.Include.NON_NULL) String description) {

    /** {@code {"label":"M","available":true}}, in site order. */
    record Size(String label, boolean available) {}

    /** {@code {"name":"бежевий","hex":"#D9C4A5"}}; {@code hex} is null for an unknown colour name. */
    record Color(String name, String hex) {}
}
