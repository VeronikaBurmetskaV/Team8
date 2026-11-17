package ua.fulla.catalogimport;

import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import ua.fulla.products.ImportedCard;
import ua.fulla.products.ProductService;

/**
 * Stores what an importer read (ADR-0014, T-15…T-18). No network here: the fetching part lives
 * in {@link CatalogImportJob}, which exists only in profile dev. Cards are written only through
 * {@link ProductService}, the one package that changes card status.
 */
@Service
class CatalogSyncService {

    private static final Logger log = LoggerFactory.getLogger(CatalogSyncService.class);

    private final CatalogSourceRepository sources;
    private final ProductService products;

    CatalogSyncService(CatalogSourceRepository sources, ProductService products) {
        this.sources = sources;
        this.products = products;
    }

    UUID registerSource(String code, String baseUrl) {
        return sources.registerSource(code, baseUrl);
    }

    /** T-18: false when the source already ran in the last 6 hours. */
    boolean claimRun(String code) {
        return sources.claimRun(code);
    }

    void finishRun(String code, RunStatus status) {
        sources.finishRun(code, status);
    }

    /**
     * Upserts every item (new card, or new price, sizes and availability for a known
     * {@code external_id}; the same ID twice in one batch is stored once). After a complete
     * batch, the source's published cards that the batch didn't contain are hidden (T-16);
     * after an incomplete one nothing is hidden, so a network error doesn't empty the feed.
     */
    RunStatus apply(UUID sourceId, ImportBatch batch) {
        Set<String> seen = new LinkedHashSet<>();
        Map<String, UUID> brandIds = new HashMap<>();
        int stored = 0;
        for (ImportedItem item : batch.items()) {
            if (!seen.add(item.externalId())) {
                continue;
            }
            try {
                UUID brandId = brandIds.computeIfAbsent(item.brandName(), name -> sources.sourceBrandId(sourceId, name));
                products.upsertImported(new ImportedCard(
                    sourceId,
                    brandId,
                    item.externalId(),
                    item.name(),
                    item.priceUah(),
                    item.photoUrl(),
                    item.productUrl(),
                    item.available(),
                    item.sizes(),
                    item.colors(),
                    item.material(),
                    item.description()));
                stored++;
            } catch (DataIntegrityViolationException e) {
                // Still counted as seen, so an existing card of this item is not hidden by mistake.
                log.warn("Imported item {} rejected by the database: {}", item.externalId(), e.getMostSpecificCause().getMessage());
            }
        }
        int hidden = batch.complete() ? products.unpublishMissingImported(sourceId, seen) : 0;
        log.info("Source {}: {} items stored, {} missing cards hidden, complete={}", sourceId, stored, hidden,
            batch.complete());
        return batch.complete() ? RunStatus.OK : RunStatus.PARTIAL;
    }
}
