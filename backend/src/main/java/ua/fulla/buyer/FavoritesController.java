package ua.fulla.buyer;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import ua.fulla.common.SessionAccount;

/**
 * {@code /api/me/favorites} (api.md §2.3, ADR-0012): ROLE_BUYER only (SecurityConfig). The buyer
 * always comes from the session, never from the request.
 */
@RestController
class FavoritesController {

    record FavoritesRequest(
            @NotNull(message = "VALIDATION_FAILED: productIds is required")
            @Size(max = FavoritesService.MAX_IDS_PER_REQUEST,
                  message = "VALIDATION_FAILED: at most 500 productIds per request")
            List<@NotNull(message = "VALIDATION_FAILED: productIds must be UUIDs") UUID> productIds) {}

    record FavoritesResponse(List<UUID> productIds) {}

    /** After a write: the full set, and the new IDs that did not fit under the limit. */
    record MergeResponse(List<UUID> productIds, List<UUID> skippedIds) {}

    private final FavoritesService service;

    FavoritesController(FavoritesService service) {
        this.service = service;
    }

    @GetMapping("/api/me/favorites")
    FavoritesResponse list(@AuthenticationPrincipal SessionAccount buyer) {
        return new FavoritesResponse(service.list(buyer.accountId()));
    }

    @PostMapping("/api/me/favorites")
    MergeResponse add(@AuthenticationPrincipal SessionAccount buyer, @Valid @RequestBody FavoritesRequest body) {
        FavoritesService.Merge merge = service.add(buyer.accountId(), body.productIds());
        return new MergeResponse(merge.productIds(), merge.skippedIds());
    }
}
