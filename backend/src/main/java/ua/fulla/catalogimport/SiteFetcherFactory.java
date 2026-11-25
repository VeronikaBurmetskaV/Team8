package ua.fulla.catalogimport;

import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Set;

/**
 * Creates the {@link PoliteFetcher} for one brand site run (ADR-0017): the verified domain and
 * its subdomains only, {@code FULLA-bot} User-Agent, allowed content types. A bean (see
 * {@link BrandImportConfig}), so tests can give it a fake {@code HttpClient} and resolver.
 */
class SiteFetcherFactory {

    /** Media types a brand site may answer with; anything else is not read. */
    static final Set<String> CONTENT_TYPES = Set.of(
        "text/html", "application/xhtml+xml", "text/plain",
        "application/xml", "text/xml", "application/rss+xml", "application/atom+xml",
        "application/json", "application/ld+json");

    private final HttpClient client;
    private final PoliteFetcher.Resolver resolver;
    private final Duration delay;
    private final String userAgent;

    SiteFetcherFactory(HttpClient client, PoliteFetcher.Resolver resolver, Duration delay, String userAgent) {
        this.client = client;
        this.resolver = resolver;
        this.delay = delay;
        this.userAgent = userAgent;
    }

    /**
     * @param domain the verified site domain, e.g. {@code brand.ua}
     * @param host   the host of the brand's {@code websiteUrl} (the domain or a subdomain), e.g. {@code www.brand.ua}
     */
    PoliteFetcher forSite(String domain, String host, int maxRequests) {
        URI home = URI.create("https://" + host + "/");
        var policy = new PoliteFetcher.Policy(userAgent, BrandImportProperties.AGENT_TOKEN, domain, true,
            CONTENT_TYPES, resolver);
        return new PoliteFetcher(client, home, delay, maxRequests, policy);
    }
}
