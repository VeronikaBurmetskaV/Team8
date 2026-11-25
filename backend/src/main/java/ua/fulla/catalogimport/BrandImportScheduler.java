package ua.fulla.catalogimport;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * The daily refresh of brand imports (ADR-0017), in every profile: checks once per
 * {@code fulla.brand-import.refresh-check-interval} which brands are due (verified site,
 * imported cards, last run older than {@code refresh-interval}, 24 h by default).
 */
@Component
class BrandImportScheduler {

    private static final Logger log = LoggerFactory.getLogger(BrandImportScheduler.class);

    private final BrandImportService imports;
    private final BrandImportProperties properties;

    BrandImportScheduler(BrandImportService imports, BrandImportProperties properties) {
        this.imports = imports;
        this.properties = properties;
    }

    @Scheduled(initialDelayString = "${fulla.brand-import.refresh-check-initial-delay:PT5M}",
               fixedDelayString = "${fulla.brand-import.refresh-check-interval:PT1H}")
    void refresh() {
        if (!properties.autoRefresh()) {
            return;
        }
        try {
            imports.refreshDue();
        } catch (RuntimeException e) {
            log.error("Daily brand import refresh failed", e);
        }
    }
}
