package ua.fulla.catalogimport;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;

/**
 * Runs the importers: shortly after start, then every check interval. The database gate (T-18)
 * makes a source actually run at most once per {@code fulla.import.min-run-interval} (6 h by
 * default, never below 10 min), also across restarts. Sources run one
 * after another; an error in one source never stops the others.
 */
class CatalogImportJob {

    private static final Logger log = LoggerFactory.getLogger(CatalogImportJob.class);

    private final List<CatalogImporter> importers;
    private final CatalogSyncService sync;
    private final ImportProperties properties;
    private final HttpClient httpClient;

    CatalogImportJob(List<CatalogImporter> importers, CatalogSyncService sync, ImportProperties properties,
            HttpClient httpClient) {
        this.importers = List.copyOf(importers);
        this.sync = sync;
        this.properties = properties;
        this.httpClient = httpClient;
    }

    @Scheduled(initialDelayString = "${fulla.import.initial-delay:PT10S}",
               fixedDelayString = "${fulla.import.check-interval:PT30M}")
    void runDueSources() {
        for (CatalogImporter importer : importers) {
            try {
                runSource(importer);
            } catch (RuntimeException e) {
                log.error("Import of {} failed", importer.code(), e);
            }
        }
    }

    RunStatus runSource(CatalogImporter importer) {
        String code = importer.code();
        UUID sourceId = sync.registerSource(code, importer.baseUrl().toString());
        Duration minInterval = properties.minRunInterval();
        if (!sync.claimRun(code, minInterval)) {
            log.info("Import of {} skipped: it already ran in the last {} min", code, minInterval.toMinutes());
            return null;
        }
        PoliteFetcher fetcher = new PoliteFetcher(httpClient, importer.baseUrl(), properties.delay(),
            properties.maxRequests());
        RunStatus status;
        try {
            fetcher.loadRobots();
        } catch (SourceStoppedException e) {
            log.warn("Import of {} skipped: {}", code, e.getMessage());
            sync.finishRun(code, RunStatus.SKIPPED);
            return RunStatus.SKIPPED;
        }
        try {
            ImportBatch batch = importer.fetch(fetcher, properties.maxProducts());
            status = sync.apply(sourceId, batch);
        } catch (Exception e) {
            log.warn("Import of {} failed: {}", code, e.getMessage());
            status = RunStatus.FAILED;
        }
        sync.finishRun(code, status);
        log.info("Import of {} finished: {} after {} requests", code, status, fetcher.requestsMade());
        return status;
    }
}
