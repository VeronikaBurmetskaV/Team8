package ua.fulla.images;

import java.io.IOException;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import ua.fulla.common.SessionAccount;

/**
 * {@code POST /api/images} (ROLE_BRAND, Q-03) and the public {@code GET /api/images/{id}} (api.md §2.1, §2.2).
 * The 5 MB limit is enforced twice: by {@code spring.servlet.multipart.max-file-size} while the
 * request is read, and again by {@link ImageService}.
 */
@RestController
class ImageController {

    record UploadResponse(UUID id, String url) {}

    private final ImageService service;

    ImageController(ImageService service) {
        this.service = service;
    }

    /** multipart/form-data with the field {@code file}; a missing file is IMAGE_INVALID like an empty one. */
    @PostMapping("/api/images")
    @ResponseStatus(HttpStatus.CREATED)
    UploadResponse upload(@AuthenticationPrincipal SessionAccount brand,
            @RequestParam(name = "file", required = false) MultipartFile file) throws IOException {
        byte[] bytes = file == null ? new byte[0] : file.getBytes();
        UUID id = service.upload(brand.accountId(), bytes);
        return new UploadResponse(id, "/api/images/" + id);
    }

    /** Images never change (a new upload gets a new ID), so browsers may cache them for a year. */
    @GetMapping("/api/images/{id}")
    ResponseEntity<byte[]> get(@PathVariable UUID id) {
        StoredImage image = service.get(id);
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(image.contentType()))
            .header("X-Content-Type-Options", "nosniff")
            .header(HttpHeaders.CACHE_CONTROL, "public, max-age=31536000, immutable")
            .body(image.bytes());
    }
}
