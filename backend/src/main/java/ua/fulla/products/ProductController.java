package ua.fulla.products;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
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

    /** Brand card = PublicCard + {@code photoImageId, status, publishedAt, createdAt} (api.md §2.1, §2.2). */
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
            Instant createdAt) {

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
                card.createdAt());
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
        var draft = new ProductDraft(
            request.name(),
            request.priceUah().intValueExact(),
            request.photoImageId(),
            request.photoUrl(),
            request.productUrl());
        return BrandCardResponse.of(service.createDraft(brand.accountId(), draft));
    }
}
