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

    static final int NAME_MIN = 2;
    static final int NAME_MAX = 50;

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

    /** Saves the brand name: 2–50 characters after trimming (US-22.1 CL). Logo and consent come later. */
    @Transactional
    public BrandProfile saveName(UUID brandId, String rawName) {
        String name = rawName == null ? "" : rawName.strip();
        // Code points, like char_length() in the database CHECK
        int length = name.codePointCount(0, name.length());
        if (length < NAME_MIN || length > NAME_MAX) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.PROFILE_INVALID,
                "name must be 2-50 characters", Map.of("name", ErrorCode.PROFILE_INVALID));
        }
        return repository.updateName(brandId, name).orElseThrow(() -> missingProfile(brandId));
    }

    // Registration always creates the profile row (T-9), so this is a broken-data case, not a 404.
    private static IllegalStateException missingProfile(UUID brandId) {
        return new IllegalStateException("Brand account " + brandId + " has no profile row");
    }
}
