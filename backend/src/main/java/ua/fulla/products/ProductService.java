package ua.fulla.products;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ua.fulla.common.ApiException;
import ua.fulla.common.ErrorCode;
import ua.fulla.images.ImageService;

@Service
public class ProductService {

    private final ProductRepository repository;
    private final ImageService images;

    ProductService(ProductRepository repository, ImageService images) {
        this.repository = repository;
        this.images = images;
    }

    List<ProductCard> listOwn(UUID brandId) {
        return repository.listOwn(brandId);
    }

    /**
     * Creates a Draft card (US-25.1, US-26). The field formats are already checked by Bean
     * Validation on the request record; here come the rules that need the database.
     */
    @Transactional
    ProductCard createDraft(UUID brandId, ProductDraft draft) {
        // T-8: an unknown image and another brand's image get the same answer (Q-04).
        if (draft.photoImageId() != null && !images.isOwnedBy(draft.photoImageId(), brandId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND,
                "photoImageId is unknown or belongs to another brand", Map.of("photoImageId", ErrorCode.NOT_FOUND));
        }
        // T-2: the insert itself checks that the brand name is saved.
        UUID id = repository.insertDraft(brandId, draft)
            .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, ErrorCode.PROFILE_INCOMPLETE,
                "Save the brand name before creating cards"));
        return repository.findOwn(id, brandId)
            .orElseThrow(() -> new IllegalStateException("Card " + id + " vanished right after its insert"));
    }

    /**
     * Draft → Published (US-31, US-22.2). The rules are checked by the {@code UPDATE} itself (T-1).
     * When it changes nothing, the card is re-read only to choose the answer: unknown or another
     * brand's card → 404 (Q-04); already Published → 409 INVALID_STATE; still a Draft → the only
     * remaining condition is the consent → 409 CONSENT_REQUIRED.
     *
     * <p>{@code PUBLISH_FIELDS_MISSING} is never returned: the NOT NULL and CHECK constraints on
     * {@code products} make every Draft complete (US-31 S2 note, G-02).
     */
    @Transactional
    ProductCard publish(UUID brandId, UUID id) {
        if (repository.publish(id, brandId) == 0) {
            ProductCard card = findOwnOrNotFound(id, brandId);
            if (card.status() == ProductStatus.PUBLISHED) {
                throw new ApiException(HttpStatus.CONFLICT, ErrorCode.INVALID_STATE, "card is already published");
            }
            throw new ApiException(HttpStatus.CONFLICT, ErrorCode.CONSENT_REQUIRED,
                "Brand consent is required before publishing");
        }
        return findOwnOrNotFound(id, brandId);
    }

    /** Published → Draft (US-31 CL), T-4. Consent is not needed to hide a card. */
    @Transactional
    ProductCard unpublish(UUID brandId, UUID id) {
        if (repository.unpublish(id, brandId) == 0) {
            findOwnOrNotFound(id, brandId);
            throw new ApiException(HttpStatus.CONFLICT, ErrorCode.INVALID_STATE, "card is already a draft");
        }
        return findOwnOrNotFound(id, brandId);
    }

    private ProductCard findOwnOrNotFound(UUID id, UUID brandId) {
        // An unknown card and another brand's card get the same answer (Q-04, INV-07).
        return repository.findOwn(id, brandId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND,
                "card is unknown or belongs to another brand"));
    }

    /**
     * Dev-only demo import (ADR-0014, T-15): creates or updates the card of one source item.
     * Only rows with a {@code source_id} are touched; T-1 (consent) and T-2 (brand name) don't
     * apply to them (data-model.md §5.4). Returns the card ID.
     */
    public UUID upsertImported(ImportedCard card) {
        return repository.upsertImported(card);
    }

    /**
     * T-16: after a complete run, hides (Draft) the source's published cards that the run did not
     * see. Never deletes. Returns how many cards were hidden.
     */
    public int unpublishMissingImported(UUID sourceId, Collection<String> seenExternalIds) {
        return repository.unpublishMissingImported(sourceId, seenExternalIds);
    }
}
