package ua.fulla.products;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ua.fulla.brandprofile.BrandProfileService;
import ua.fulla.common.ApiException;
import ua.fulla.common.ErrorCode;
import ua.fulla.images.ImageService;

@Service
public class ProductService {

    /** Bulk publish result (api.md): the published IDs and the ones that were not (unknown, foreign, not a Draft). */
    record BulkPublishResult(List<UUID> publishedIds, List<UUID> skippedIds) {}

    private final ProductRepository repository;
    private final ImageService images;
    private final BrandProfileService profiles;

    ProductService(ProductRepository repository, ImageService images, BrandProfileService profiles) {
        this.repository = repository;
        this.images = images;
        this.profiles = profiles;
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
     * Edits a Draft (US-26 S1, T-3). Same field rules as create; a Published card →
     * {@code 409 CARD_NOT_EDITABLE}; an unknown or foreign card → 404. Fields of an imported card
     * that change are marked as edited by hand, so the next import keeps them (ADR-0017).
     */
    @Transactional
    ProductCard updateDraft(UUID brandId, UUID id, ProductDraft draft) {
        if (draft.photoImageId() != null && !images.isOwnedBy(draft.photoImageId(), brandId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND,
                "photoImageId is unknown or belongs to another brand", Map.of("photoImageId", ErrorCode.NOT_FOUND));
        }
        if (repository.updateDraft(id, brandId, draft) == 0) {
            findOwnOrNotFound(id, brandId);
            throw new ApiException(HttpStatus.CONFLICT, ErrorCode.CARD_NOT_EDITABLE,
                "a published card can't be edited; unpublish it first");
        }
        return findOwnOrNotFound(id, brandId);
    }

    /**
     * Publishes many Drafts at once (ADR-0017, e.g. imported drafts) with the same gate as one
     * card (T-1): one conditional {@code UPDATE}. Nothing published and no consent →
     * {@code 409 CONSENT_REQUIRED}; IDs that are unknown, foreign or not a Draft are returned in
     * {@code skippedIds} (no 404, so nothing about other brands is revealed).
     */
    @Transactional
    BulkPublishResult publishMany(UUID brandId, List<UUID> ids) {
        Set<UUID> requested = new LinkedHashSet<>(ids);
        List<UUID> published = repository.publishMany(requested, brandId);
        if (published.isEmpty() && profiles.get(brandId).consentGivenAt() == null) {
            throw new ApiException(HttpStatus.CONFLICT, ErrorCode.CONSENT_REQUIRED,
                "Brand consent is required before publishing");
        }
        Set<UUID> done = Set.copyOf(published);
        List<UUID> publishedInOrder = requested.stream().filter(done::contains).toList();
        List<UUID> skipped = requested.stream().filter(id -> !done.contains(id)).toList();
        return new BulkPublishResult(publishedInOrder, skipped);
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
     * Brand site import (ADR-0017): stores one item of the brand's site. An existing card of the
     * same {@code externalId} is updated (hand-edited fields kept, also on a Published card); a new
     * one becomes a Draft, only when {@code available} (a sold-out item is not added). The import
     * never publishes.
     */
    @Transactional
    public BrandImportedCard.Result storeBrandImported(BrandImportedCard card, boolean available) {
        Optional<Boolean> changed = repository.updateBrandImported(card);
        if (changed.isPresent()) {
            return changed.get() ? BrandImportedCard.Result.UPDATED : BrandImportedCard.Result.UNCHANGED;
        }
        if (!available) {
            return BrandImportedCard.Result.NOT_CREATED;
        }
        return repository.insertBrandImported(card).isPresent()
            ? BrandImportedCard.Result.CREATED
            : BrandImportedCard.Result.NOT_CREATED;
    }

    /** ADR-0017: the brand's Published imported cards of these (sold-out) items go to Draft. */
    public int hideBrandImported(UUID brandId, Collection<String> externalIds) {
        return repository.hideBrandImported(brandId, externalIds);
    }

    /**
     * ADR-0017, like T-16: after a complete listing of the site, the brand's Published imported
     * cards that the site no longer lists go to Draft. Never deletes.
     */
    public int hideMissingBrandImported(UUID brandId, Collection<String> listedExternalIds) {
        return repository.hideMissingBrandImported(brandId, listedExternalIds);
    }

    /**
     * T-16: after a complete run, hides (Draft) the source's published cards that the run did not
     * see. Never deletes. Returns how many cards were hidden.
     */
    public int unpublishMissingImported(UUID sourceId, Collection<String> seenExternalIds) {
        return repository.unpublishMissingImported(sourceId, seenExternalIds);
    }
}
