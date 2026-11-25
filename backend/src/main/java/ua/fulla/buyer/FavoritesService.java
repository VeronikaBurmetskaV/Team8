package ua.fulla.buyer;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ua.fulla.common.ApiException;
import ua.fulla.common.ErrorCode;

/**
 * «Вподобане» of a registered buyer (ADR-0012): append-only, merged by set union, at most
 * {@value #FAVORITES_LIMIT_ACCOUNT} products. The browser of a guest keeps at most 25
 * (FAVORITES_LIMIT_GUEST in frontend/src/shared/favoritesLimit.ts).
 */
@Service
class FavoritesService {

    /** The one place of the account limit on the backend (the frontend repeats it). */
    static final int FAVORITES_LIMIT_ACCOUNT = 100;
    /** Request size cap (api.md §2.3, T-11). */
    static final int MAX_IDS_PER_REQUEST = 500;

    /** The full list after the write, and the new IDs that did not fit under the limit. */
    record Merge(List<UUID> productIds, List<UUID> skippedIds) {}

    private final FavoritesRepository repository;

    FavoritesService(FavoritesRepository repository) {
        this.repository = repository;
    }

    List<UUID> list(UUID buyerId) {
        return repository.list(buyerId);
    }

    /**
     * The only write (a like, the merge after register/login, a retry). Unknown product IDs and
     * IDs already saved are ignored. New IDs are added in request order until the buyer has
     * {@value #FAVORITES_LIMIT_ACCOUNT}; the rest come back as {@code skippedIds}. When there was
     * something new but nothing fitted: {@code 409 FAVORITES_LIMIT_REACHED}, nothing changes.
     * The buyer's row is locked first, so parallel writes cannot pass the limit together.
     */
    @Transactional
    Merge add(UUID buyerId, List<UUID> requested) {
        repository.lockBuyer(buyerId);
        List<UUID> current = repository.list(buyerId);
        Set<UUID> saved = new HashSet<>(current);
        Set<UUID> known = new HashSet<>(repository.existingProducts(List.copyOf(new LinkedHashSet<>(requested))));

        List<UUID> fresh = new ArrayList<>();
        for (UUID id : new LinkedHashSet<>(requested)) {
            if (known.contains(id) && !saved.contains(id)) {
                fresh.add(id);
            }
        }
        int room = Math.max(0, FAVORITES_LIMIT_ACCOUNT - current.size());
        List<UUID> added = fresh.subList(0, Math.min(room, fresh.size()));
        List<UUID> skipped = fresh.subList(added.size(), fresh.size());
        if (!fresh.isEmpty() && added.isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT, ErrorCode.FAVORITES_LIMIT_REACHED,
                "favourites are full: at most " + FAVORITES_LIMIT_ACCOUNT + " products");
        }
        repository.insert(buyerId, added);
        return new Merge(repository.list(buyerId), List.copyOf(skipped));
    }
}
