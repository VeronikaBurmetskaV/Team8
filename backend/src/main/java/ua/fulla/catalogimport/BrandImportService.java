package ua.fulla.catalogimport;

import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.RejectedExecutionException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import ua.fulla.brandprofile.BrandProfile;
import ua.fulla.brandprofile.BrandProfileService;
import ua.fulla.common.ApiException;
import ua.fulla.common.ErrorCode;
import ua.fulla.common.SiteDomain;
import ua.fulla.products.BrandImportedCard;
import ua.fulla.products.ProductService;

/**
 * Brand site import (ADR-0017): starts a run (at most one per brand per 10 min), runs it in the
 * background, stores the items as the brand's Draft cards through {@link ProductService} and
 * keeps the state in {@code brand_imports}. The import never publishes.
 */
@Service
class BrandImportService {

    private static final Logger log = LoggerFactory.getLogger(BrandImportService.class);
    /** How many brands one scheduler pass refreshes at most. */
    static final int REFRESH_BATCH = 20;

    private final BrandImportRepository repository;
    private final BrandProfileService profiles;
    private final ProductService products;
    private final SiteFetcherFactory fetchers;
    private final BrandImportProperties properties;
    private final Executor executor;
    private final SiteVerificationPolicy verification;

    BrandImportService(BrandImportRepository repository, BrandProfileService profiles, ProductService products,
            SiteFetcherFactory fetchers, BrandImportProperties properties, ExecutorService brandImportExecutor,
            SiteVerificationPolicy verification) {
        this.verification = verification;
        this.repository = repository;
        this.profiles = profiles;
        this.products = products;
        this.fetchers = fetchers;
        this.properties = properties;
        this.executor = brandImportExecutor;
    }

    /** False only in demo mode (profile dev, ADR-0017): then no ownership check before an import. */
    boolean verificationRequired() {
        return verification.required();
    }

    /**
     * The domain an import of this profile may read: the verified one, or in demo mode the
     * domain of {@code websiteUrl}. Null when there is none (no website, or not verified).
     */
    private String importDomain(BrandProfile profile) {
        if (verification.required()) {
            return profile.siteVerified() ? profile.siteDomain() : null;
        }
        return SiteDomain.of(profile.websiteUrl());
    }

    BrandImportState status(UUID brandId) {
        return repository.find(brandId).orElseGet(() -> BrandImportState.idle(brandId));
    }

    /**
     * {@code POST /api/brand/import}: the brand name must be saved (cards need it, T-2), the site
     * verified; then one run is claimed and started in the background. Answers right away.
     */
    BrandImportState requestImport(UUID brandId) {
        BrandProfile profile = profiles.get(brandId);
        if (profile.name() == null) {
            throw new ApiException(HttpStatus.CONFLICT, ErrorCode.PROFILE_INCOMPLETE,
                "Save the brand name before importing");
        }
        if (!verification.required() && profile.websiteUrl() == null) {
            throw new ApiException(HttpStatus.CONFLICT, ErrorCode.SITE_NOT_SET, "Save the brand's website first");
        }
        if (importDomain(profile) == null) {
            // Outside demo mode the ownership check is mandatory (ADR-0017), also for direct API calls.
            throw new ApiException(HttpStatus.FORBIDDEN, ErrorCode.SITE_NOT_VERIFIED,
                "Verify the ownership of the website first");
        }
        if (!repository.claim(brandId, properties.importInterval(), BrandImportProperties.STALE_RUN)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, ErrorCode.IMPORT_TOO_FREQUENT,
                "An import of this brand ran less than " + properties.importInterval().toMinutes()
                    + " minutes ago or is still running");
        }
        try {
            executor.execute(() -> runClaimed(brandId));
        } catch (RejectedExecutionException e) {
            repository.finish(brandId, false, null, BrandImportState.Counts.NONE, ErrorCode.IMPORT_FAILED.name());
            throw e;
        }
        return status(brandId);
    }

    /** The daily refresh (ADR-0017): the same claim, the interval is the refresh interval. */
    void refreshDue() {
        for (UUID brandId : repository.dueForRefresh(properties.refreshEvery(), REFRESH_BATCH,
                verification.required())) {
            if (repository.claim(brandId, properties.refreshEvery(), BrandImportProperties.STALE_RUN)) {
                runClaimed(brandId);
            }
        }
    }

    @EventListener(ApplicationReadyEvent.class)
    void failInterruptedRuns() {
        int interrupted = repository.failInterrupted(ErrorCode.IMPORT_FAILED.name());
        if (interrupted > 0) {
            log.info("{} brand imports were interrupted by a restart", interrupted);
        }
    }

    /** Runs an already claimed import and always records its end. */
    void runClaimed(UUID brandId) {
        try {
            run(brandId);
        } catch (RuntimeException e) {
            log.error("Brand import of {} failed", brandId, e);
            repository.finish(brandId, false, null, BrandImportState.Counts.NONE, ErrorCode.IMPORT_FAILED.name());
        }
    }

    private void run(UUID brandId) {
        BrandProfile profile = profiles.get(brandId);
        String domain = importDomain(profile);
        if (domain == null || profile.name() == null) {
            fail(brandId, null, BrandImportState.Counts.NONE, ErrorCode.SITE_NOT_VERIFIED);
            return;
        }
        String host = URI.create(profile.websiteUrl()).getHost();
        // The fetcher's SSRF guards apply in demo mode too; only the ownership check is skipped.
        PoliteFetcher fetcher = fetchers.forSite(domain, host, properties.requestCap());
        ImportBatch batch;
        try {
            fetcher.loadRobots();
            batch = new GenericSiteImporter(fetcher.baseUrl(), profile.feedUrl(), profile.name())
                .fetch(fetcher, properties.productCap());
        } catch (SourceStoppedException | IOException e) {
            log.info("Brand import of {}: site unreachable: {}", brandId, e.getMessage());
            fail(brandId, null, BrandImportState.Counts.NONE, ErrorCode.SITE_UNREACHABLE);
            return;
        }
        if (batch.items().isEmpty()) {
            ErrorCode code = batch.method() == null && fetcher.robotsBlocked() > 0
                ? ErrorCode.SITE_ROBOTS_DISALLOWED : ErrorCode.NO_PRODUCTS_FOUND;
            fail(brandId, batch.method(), new BrandImportState.Counts(batch.skipped(), 0, 0, batch.skipped(), 0), code);
            return;
        }
        BrandImportState.Counts counts = apply(brandId, batch);
        repository.finish(brandId, true, batch.method(), counts, null);
        log.info("Brand import of {} done via {}: {}", brandId, batch.method(), counts);
    }

    /**
     * Stores a batch (ADR-0017): every item is created (as a Draft, only when in stock) or
     * updated (hand-edited fields kept); sold-out items are hidden; after a complete listing, the
     * brand's published imported cards the site no longer lists are hidden. Never deletes.
     */
    BrandImportState.Counts apply(UUID brandId, ImportBatch batch) {
        Set<String> seen = new LinkedHashSet<>();
        List<String> soldOut = new ArrayList<>();
        int created = 0;
        int updated = 0;
        int skipped = batch.skipped();
        for (ImportedItem item : batch.items()) {
            if (!seen.add(item.externalId())) {
                continue;
            }
            String sourceUrl = batch.sourceUrl() != null ? batch.sourceUrl() : item.productUrl();
            var card = new BrandImportedCard(brandId, item.externalId(), sourceUrl, item.name(), item.priceUah(),
                item.photoUrl(), item.productUrl(), item.sizes(), item.colors(), item.material(), item.description());
            switch (products.storeBrandImported(card, item.available())) {
                case CREATED -> created++;
                case UPDATED -> updated++;
                case UNCHANGED -> { }
                case NOT_CREATED -> skipped++;
            }
            if (!item.available()) {
                soldOut.add(item.externalId());
            }
        }
        int hidden = products.hideBrandImported(brandId, soldOut);
        if (batch.complete()) {
            hidden += products.hideMissingBrandImported(brandId, batch.listedIds());
        }
        int found = batch.items().size() + batch.skipped();
        return new BrandImportState.Counts(found, created, updated, skipped, hidden);
    }

    private void fail(UUID brandId, String method, BrandImportState.Counts counts, ErrorCode code) {
        repository.finish(brandId, false, method, counts, code.name());
    }
}
