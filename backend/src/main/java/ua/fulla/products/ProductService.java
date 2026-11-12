package ua.fulla.products;

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
class ProductService {

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
}
