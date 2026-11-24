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

    /**
     * The consent checkbox label, exactly as shown in the cabinet (US-22.2 CL). Stored with the
     * consent (A-17), so the text is fixed by the server, never taken from the request.
     */
    static final String CONSENT_TEXT =
        "Я надаю згоду платформі FULLA на демонстрацію логотипа, фотографій та інформації про товари мого бренду";

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
     * Saves the brand name (US-22.1 CL) and records the consent (US-22.2); the name format and the
     * logo URL are already checked by Bean Validation on the request record.
     *
     * <p>Consent is one-way for the brand (INV-09, T-5): {@code consentGiven=true} records the time
     * and {@link #CONSENT_TEXT} once, in the same {@code UPDATE} as the name, and never moves them;
     * {@code consentGiven=false} after consent was given is refused with {@code 409 CONSENT_LOCKED}
     * and nothing is saved. Only the operator ({@code ops}) withdraws consent (T-6).
     *
     * <p>The logo is not implemented yet (final-review №3): instead of answering 200 and silently
     * dropping it, any logo is refused with {@code 400 PROFILE_INVALID}, {@code fields.logo}, and
     * nothing is saved. Remove this check when the logo is stored.
     */
    @Transactional
    public BrandProfile save(UUID brandId, String rawName, UUID logoImageId, String logoUrl, Boolean consentGiven) {
        // A rule across two fields: a logo is an uploaded image or an external URL, never both.
        if (logoImageId != null && logoUrl != null) {
            // Map.of has no order; the two fields carry the same code anyway.
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.PROFILE_INVALID,
                "give either logoImageId or logoUrl, not both",
                Map.of("logoImageId", ErrorCode.PROFILE_INVALID, "logoUrl", ErrorCode.PROFILE_INVALID));
        }
        if (logoImageId != null || (logoUrl != null && !logoUrl.isEmpty())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.PROFILE_INVALID,
                "the logo is not supported yet; send logoImageId and logoUrl as null",
                Map.of("logo", ErrorCode.PROFILE_INVALID));
        }
        if (Boolean.FALSE.equals(consentGiven) && get(brandId).consentGivenAt() != null) {
            throw new ApiException(HttpStatus.CONFLICT, ErrorCode.CONSENT_LOCKED,
                "consent was already given and cannot be withdrawn by the brand");
        }
        String name = BrandNameValidator.normalize(rawName);
        boolean giveConsent = Boolean.TRUE.equals(consentGiven);
        return repository.updateNameAndConsent(brandId, name, giveConsent, CONSENT_TEXT)
            .orElseThrow(() -> missingProfile(brandId));
    }

    // Registration always creates the profile row (T-9), so this is a broken-data case, not a 404.
    private static IllegalStateException missingProfile(UUID brandId) {
        return new IllegalStateException("Brand account " + brandId + " has no profile row");
    }
}
