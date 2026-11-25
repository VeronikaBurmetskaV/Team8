package ua.fulla.products;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ua.fulla.common.HttpUrl;
import ua.fulla.common.HttpsUrl;
import ua.fulla.common.SessionAccount;

/** {@code /api/brand/products} (api.md §2.1); ROLE_BRAND is required by SecurityConfig. */
@RestController
class ProductController {

    private static final String PRICE_OR_PHOTO = "CARD_INVALID_PRICE_OR_PHOTO: ";
    private static final String URL = "CARD_INVALID_URL: ";

    /**
     * The card form (api.md §4.1), fields in form order. The brand comes from the session,
     * never from the body. {@code priceUah} is a BigDecimal so that 2400.5 is refused instead
     * of being cut to 2400; varchar(2048) limits the URLs.
     */
    @OnePhotoSource
    record CardRequest(
            @CardName String name,
            @NotNull(message = PRICE_OR_PHOTO + "priceUah is required")
            @Positive(message = PRICE_OR_PHOTO + "priceUah must be greater than 0")
            @Max(value = 1_000_000, message = PRICE_OR_PHOTO + "priceUah must be at most 1000000")
            @Digits(integer = 7, fraction = 0, message = PRICE_OR_PHOTO + "priceUah must be a whole number")
            BigDecimal priceUah,
            UUID photoImageId,
            @Size(max = 2048, message = PRICE_OR_PHOTO + "photoUrl must be at most 2048 characters")
            @HttpsUrl(message = PRICE_OR_PHOTO + "photoUrl must be an https:// URL")
            String photoUrl,
            @NotNull(message = URL + "productUrl is required")
            @Size(max = 2048, message = URL + "productUrl must be at most 2048 characters")
            @HttpUrl(message = URL + "productUrl must be an absolute http:// or https:// URL")
            String productUrl) {}

    /** Bulk publish (ADR-0017): 1…500 card IDs. */
    record BulkPublishRequest(
            @NotNull(message = "VALIDATION_FAILED: ids is required")
            @Size(min = 1, max = 500, message = "VALIDATION_FAILED: ids must have 1 to 500 items")
            List<@NotNull UUID> ids) {}

    record BulkPublishResponse(List<UUID> publishedIds, List<UUID> skippedIds) {}

    record BulkUnpublishResponse(List<UUID> unpublishedIds, List<UUID> skippedIds) {}

    /**
     * Brand card = PublicCard + {@code photoImageId, status, publishedAt, createdAt} (api.md §2.1, §2.2),
     * plus {@code sourceUrl} only for a card imported from the brand's site (ADR-0017).
     */
    record BrandCardResponse(
            UUID id,
            String name,
            String brandName,
            int priceUah,
            String photoUrl,
            String productUrl,
            UUID photoImageId,
            ProductStatus status,
            Instant publishedAt,
            Instant createdAt,
            @JsonInclude(JsonInclude.Include.NON_NULL) String sourceUrl,
            @JsonInclude(JsonInclude.Include.NON_NULL) List<String> editedFields,
            /** «Немає на сайті» since (ADR-0017); left out while the site lists the card. */
            @JsonInclude(JsonInclude.Include.NON_NULL) Instant notOnSiteSince) {

        /** DB names of {@code products.edited_fields} → the JSON field names of the card. */
        private static final Map<String, String> EDITED_FIELD_NAMES = Map.of(
            "name", "name", "price_uah", "priceUah", "photo", "photo", "product_url", "productUrl");

        static BrandCardResponse of(ProductCard card) {
            // photoUrl is what an <img> loads: the uploaded image or the brand's https:// URL.
            String photoUrl = card.photoImageId() != null ? "/api/images/" + card.photoImageId() : card.photoUrl();
            return new BrandCardResponse(
                card.id(),
                card.name(),
                card.brandName(),
                card.priceUah(),
                photoUrl,
                card.productUrl(),
                card.photoImageId(),
                card.status(),
                card.publishedAt(),
                card.createdAt(),
                card.sourceUrl(),
                // Only an imported card has the list (ADR-0017); hand-made cards leave the key out.
                card.sourceUrl() == null ? null
                    : card.editedFields().stream().map(f -> EDITED_FIELD_NAMES.getOrDefault(f, f)).toList(),
                card.missingSince());
        }
    }

    private final ProductService service;

    ProductController(ProductService service) {
        this.service = service;
    }

    /** A plain JSON array, newest first. */
    @GetMapping("/api/brand/products")
    List<BrandCardResponse> list(@AuthenticationPrincipal SessionAccount brand) {
        return service.listOwn(brand.accountId()).stream().map(BrandCardResponse::of).toList();
    }

    @PostMapping("/api/brand/products")
    @ResponseStatus(HttpStatus.CREATED)
    BrandCardResponse create(@AuthenticationPrincipal SessionAccount brand, @Valid @RequestBody CardRequest request) {
        return BrandCardResponse.of(service.createDraft(brand.accountId(), toDraft(request)));
    }

    private static ProductDraft toDraft(CardRequest request) {
        return new ProductDraft(
            request.name(),
            request.priceUah().intValueExact(),
            request.photoImageId(),
            request.photoUrl(),
            request.productUrl());
    }

    /** US-26 S1: edits a Draft; 409 CARD_NOT_EDITABLE for a Published card. */
    @PutMapping("/api/brand/products/{id}")
    BrandCardResponse update(@AuthenticationPrincipal SessionAccount brand, @PathVariable UUID id,
            @Valid @RequestBody CardRequest request) {
        return BrandCardResponse.of(service.updateDraft(brand.accountId(), id, toDraft(request)));
    }

    /** ADR-0017: publishes many Drafts at once with the same consent gate as one card. */
    @PostMapping("/api/brand/products/publish")
    BulkPublishResponse publishMany(@AuthenticationPrincipal SessionAccount brand,
            @Valid @RequestBody BulkPublishRequest request) {
        var result = service.publishMany(brand.accountId(), request.ids());
        return new BulkPublishResponse(result.publishedIds(), result.skippedIds());
    }

    /** «Зняти вибрані з публікації» (US-31 CL): many Published cards back to Draft; the same 1…500 IDs. */
    @PostMapping("/api/brand/products/unpublish")
    BulkUnpublishResponse unpublishMany(@AuthenticationPrincipal SessionAccount brand,
            @Valid @RequestBody BulkPublishRequest request) {
        var result = service.unpublishMany(brand.accountId(), request.ids());
        return new BulkUnpublishResponse(result.unpublishedIds(), result.skippedIds());
    }

    /** US-31, api.md §4.2: no request body; 200 with the card, now {@code PUBLISHED}. */
    @PostMapping("/api/brand/products/{id}/publish")
    BrandCardResponse publish(@AuthenticationPrincipal SessionAccount brand, @PathVariable UUID id) {
        return BrandCardResponse.of(service.publish(brand.accountId(), id));
    }

    /**
     * «Прибрати зі списку» (ADR-0017): hides a «Немає на сайті» card from the cabinet list; 204.
     * 409 INVALID_STATE for a card the site still lists.
     */
    @PostMapping("/api/brand/products/{id}/remove-from-list")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void removeFromList(@AuthenticationPrincipal SessionAccount brand, @PathVariable UUID id) {
        service.removeFromList(brand.accountId(), id);
    }

    /** US-31 CL: no request body; 200 with the card, back to {@code DRAFT}. */
    @PostMapping("/api/brand/products/{id}/unpublish")
    BrandCardResponse unpublish(@AuthenticationPrincipal SessionAccount brand, @PathVariable UUID id) {
        return BrandCardResponse.of(service.unpublish(brand.accountId(), id));
    }
}
