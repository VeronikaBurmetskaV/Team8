package ua.fulla.images;

import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import ua.fulla.common.ApiException;
import ua.fulla.common.ErrorCode;

/** Upload checks and reads of images (ADR-0007, T-8, T-13). */
@Service
public class ImageService {

    /** 5 MB, the same as {@code spring.servlet.multipart.max-file-size} and the DB CHECK. */
    static final int MAX_BYTES = 5_242_880;

    private final ImageStore store;

    ImageService(ImageStore store) {
        this.store = store;
    }

    /**
     * Stores an upload of the brand. The type comes from the first bytes of the file only,
     * never from its name or the client's Content-Type (T-13); SVG and anything else is refused.
     */
    UUID upload(UUID brandId, byte[] bytes) {
        if (bytes.length == 0 || bytes.length > MAX_BYTES) {
            throw invalidImage("image must be 1 to " + MAX_BYTES + " bytes");
        }
        String contentType = detectContentType(bytes)
            .orElseThrow(() -> invalidImage("image must be PNG, JPEG or WEBP"));
        return store.save(brandId, contentType, bytes);
    }

    StoredImage get(UUID id) {
        return store.get(id)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, "No such image"));
    }

    /** T-8: a card or a profile may reference only an image its own brand uploaded. */
    public boolean isOwnedBy(UUID imageId, UUID brandId) {
        return store.isOwnedBy(imageId, brandId);
    }

    /** Magic bytes: PNG {@code 89 50 4E 47}, JPEG {@code FF D8 FF}, WEBP {@code RIFF????WEBP}. */
    static Optional<String> detectContentType(byte[] bytes) {
        if (startsWith(bytes, 0, 0x89, 'P', 'N', 'G')) {
            return Optional.of("image/png");
        }
        if (startsWith(bytes, 0, 0xFF, 0xD8, 0xFF)) {
            return Optional.of("image/jpeg");
        }
        if (startsWith(bytes, 0, 'R', 'I', 'F', 'F') && startsWith(bytes, 8, 'W', 'E', 'B', 'P')) {
            return Optional.of("image/webp");
        }
        return Optional.empty();
    }

    private static boolean startsWith(byte[] bytes, int offset, int... expected) {
        if (bytes.length < offset + expected.length) {
            return false;
        }
        for (int i = 0; i < expected.length; i++) {
            if ((bytes[offset + i] & 0xFF) != expected[i]) {
                return false;
            }
        }
        return true;
    }

    private static ApiException invalidImage(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.IMAGE_INVALID, message);
    }
}
