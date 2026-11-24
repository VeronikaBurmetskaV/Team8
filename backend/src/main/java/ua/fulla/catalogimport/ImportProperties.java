package ua.fulla.catalogimport;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * {@code fulla.import.*} from application-dev.yml (ADR-0014). The hard limits of the ADR are
 * applied on top of whatever is configured: ≥ 2 s between requests, ≤ 50 products and
 * ≤ 100 requests per source per run, ≥ 10 min between two runs of one source (6 h by default).
 */
@ConfigurationProperties("fulla.import")
record ImportProperties(
        boolean enabled,
        Duration delayBetweenRequests,
        Integer maxProductsPerSource,
        Integer maxRequestsPerSource,
        Duration minRunInterval,
        Sources sources) {

    static final Duration MIN_DELAY = Duration.ofSeconds(2);
    static final int MAX_PRODUCTS = 50;
    static final int MAX_REQUESTS = 100;
    /** T-18: a source runs at most once per this interval unless configured otherwise. */
    static final Duration DEFAULT_RUN_INTERVAL = Duration.ofHours(6);
    /** Lower bound of {@code min-run-interval}: a source is never fetched more often. */
    static final Duration MIN_RUN_INTERVAL = Duration.ofMinutes(10);
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

    /**
     * {@code fulla.import.min-run-interval}: 6 h when not set, never below 10 min. Overrides the
     * record accessor, so every caller gets the clamped value.
     */
    @Override
    public Duration minRunInterval() {
        if (minRunInterval == null) {
            return DEFAULT_RUN_INTERVAL;
        }
        return minRunInterval.compareTo(MIN_RUN_INTERVAL) < 0 ? MIN_RUN_INTERVAL : minRunInterval;
    }

    int maxProducts() {
        return maxProductsPerSource == null ? MAX_PRODUCTS : Math.min(Math.max(maxProductsPerSource, 0), MAX_PRODUCTS);
    }

    int maxRequests() {
        return maxRequestsPerSource == null ? MAX_REQUESTS : Math.min(Math.max(maxRequestsPerSource, 1), MAX_REQUESTS);
    }
}
