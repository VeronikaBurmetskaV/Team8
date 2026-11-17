package ua.fulla.catalogimport;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * {@code fulla.import.*} from application-dev.yml (ADR-0014). The hard limits of the ADR are
 * applied on top of whatever is configured: ≥ 2 s between requests, ≤ 50 products and
 * ≤ 100 requests per source per run.
 */
@ConfigurationProperties("fulla.import")
record ImportProperties(
        boolean enabled,
        Duration delayBetweenRequests,
        Integer maxProductsPerSource,
        Integer maxRequestsPerSource,
        Sources sources) {

    static final Duration MIN_DELAY = Duration.ofSeconds(2);
    static final int MAX_PRODUCTS = 50;
    static final int MAX_REQUESTS = 100;
    /**
     * At most this many products of one brand per source and run. Всі. Свої lists hundreds of
     * items of one seller in a row, and One By One and Cher'17 are one brand each; without the
     * cap the feed would be long runs of the same brand.
     */
    static final int MAX_PRODUCTS_PER_BRAND = 5;

    /** The three fixed sources; never entered through the API or UI. */
    record Sources(String vsisvoi, String onebyone, String cher17) {}

    Duration delay() {
        return delayBetweenRequests == null || delayBetweenRequests.compareTo(MIN_DELAY) < 0
            ? MIN_DELAY : delayBetweenRequests;
    }

    int maxProducts() {
        return maxProductsPerSource == null ? MAX_PRODUCTS : Math.min(Math.max(maxProductsPerSource, 0), MAX_PRODUCTS);
    }

    int maxRequests() {
        return maxRequestsPerSource == null ? MAX_REQUESTS : Math.min(Math.max(maxRequestsPerSource, 1), MAX_REQUESTS);
    }
}
