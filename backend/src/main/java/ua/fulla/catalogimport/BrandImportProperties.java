package ua.fulla.catalogimport;

import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * {@code fulla.brand-import.*} (ADR-0017), defaults in application.yml. The hard limits of the
 * ADR apply on top of whatever is configured: ≥ 2 s between requests, ≤ 50 products and
 * ≤ 100 requests per import, ≥ 10 min between two imports of one brand, a daily refresh at
 * most once per hour.
 */
@ConfigurationProperties("fulla.brand-import")
record BrandImportProperties(
        String botInfoUrl,
        Duration delayBetweenRequests,
        Integer maxProducts,
        Integer maxRequests,
        Duration minInterval,
        boolean autoRefresh,
        Duration refreshInterval,
        Boolean emailDomainVerification,
        List<String> publicEmailDomains,
        Duration verifyMinInterval,
        Boolean requireSiteVerification) {

    static final String AGENT_TOKEN = "FULLA-bot";
    static final Duration MIN_DELAY = Duration.ofSeconds(2);
    static final int MAX_PRODUCTS = 50;
    static final int MAX_REQUESTS = 100;
    static final Duration MIN_INTERVAL = Duration.ofMinutes(10);
    static final Duration MIN_REFRESH = Duration.ofHours(1);
    /** A run still marked {@code running} after this long was interrupted (a restart). */
    static final Duration STALE_RUN = Duration.ofHours(1);

    /** {@code FULLA-bot/1.0 (+https://…/bot)}: who we are and where to read about it. */
    String userAgent() {
        return AGENT_TOKEN + "/1.0 (+" + (botInfoUrl == null ? "https://fulla.example/bot" : botInfoUrl) + ")";
    }

    Duration delay() {
        return delayBetweenRequests == null || delayBetweenRequests.compareTo(MIN_DELAY) < 0
            ? MIN_DELAY : delayBetweenRequests;
    }

    int productCap() {
        return maxProducts == null ? MAX_PRODUCTS : Math.min(Math.max(maxProducts, 1), MAX_PRODUCTS);
    }

    int requestCap() {
        return maxRequests == null ? MAX_REQUESTS : Math.min(Math.max(maxRequests, 5), MAX_REQUESTS);
    }

    Duration importInterval() {
        return minInterval == null || minInterval.compareTo(MIN_INTERVAL) < 0 ? MIN_INTERVAL : minInterval;
    }

    Duration refreshEvery() {
        if (refreshInterval == null) {
            return Duration.ofDays(1);
        }
        return refreshInterval.compareTo(MIN_REFRESH) < 0 ? MIN_REFRESH : refreshInterval;
    }

    boolean emailDomainAllowed() {
        return emailDomainVerification == null || emailDomainVerification;
    }

    Set<String> publicEmailDomainSet() {
        return publicEmailDomains == null ? Set.of()
            : publicEmailDomains.stream().map(d -> d.strip().toLowerCase(Locale.ROOT)).collect(Collectors.toSet());
    }

    /** Default true (safe): only application-dev.yml turns it off (demo mode). */
    boolean siteVerificationRequired() {
        return requireSiteVerification == null || requireSiteVerification;
    }

    Duration verifyInterval() {
        return verifyMinInterval == null || verifyMinInterval.isNegative() ? Duration.ofSeconds(30) : verifyMinInterval;
    }
}
