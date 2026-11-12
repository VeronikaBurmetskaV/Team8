package ua.fulla.brandprofile;

import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ua.fulla.common.ApiException;
import ua.fulla.common.ErrorCode;

@Service
public class BrandProfileService {

    private final BrandProfileRepository repository;

    BrandProfileService(BrandProfileRepository repository) {
        this.repository = repository;
    }

    /** Called by brand registration inside its transaction (T-9). */
    @Transactional
    public void createEmpty(UUID brandId) {
        repository.insertEmpty(brandId);
    }

    public BrandProfile get(UUID brandId) {
        return repository.findByBrandId(brandId).orElseThrow(() -> missingProfile(brandId));
    }

    /**
     * Saves the brand name (US-22.1 CL); its format and the logo URL are already checked by Bean
     * Validation on the request record. The logo itself and the consent are not stored yet.
     */
    @Transactional
    public BrandProfile save(UUID brandId, String rawName, UUID logoImageId, String logoUrl) {
        // A rule across two fields: a logo is an uploaded image or an external URL, never both.
        if (logoImageId != null && logoUrl != null) {
            // Map.of has no order; the two fields carry the same code anyway.
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.PROFILE_INVALID,
                "give either logoImageId or logoUrl, not both",
                Map.of("logoImageId", ErrorCode.PROFILE_INVALID, "logoUrl", ErrorCode.PROFILE_INVALID));
        }
        String name = BrandNameValidator.normalize(rawName);
        return repository.updateName(brandId, name).orElseThrow(() -> missingProfile(brandId));
    }

    // Registration always creates the profile row (T-9), so this is a broken-data case, not a 404.
    private static IllegalStateException missingProfile(UUID brandId) {
        return new IllegalStateException("Brand account " + brandId + " has no profile row");
    }
}
