package ua.fulla.catalogimport;

import java.net.URI;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import ua.fulla.brandprofile.BrandProfile;
import ua.fulla.brandprofile.BrandProfileService;
import ua.fulla.common.ApiException;
import ua.fulla.common.ErrorCode;
import ua.fulla.common.SiteDomain;

/**
 * {@code POST /api/brand/site/verify} (ADR-0017): proves that the brand owns the domain of its
 * {@code websiteUrl} by its email domain (no network), the meta tag or the verification file.
 */
@Service
class BrandSiteService {

    /** robots.txt, the home page and the file, plus one redirect. */
    static final int VERIFY_REQUESTS = 4;

    record Verified(String siteDomain, Instant siteVerifiedAt, SiteVerifier.Method method) {}

    private final BrandProfileService profiles;
    private final SiteFetcherFactory fetchers;
    private final BrandImportProperties properties;
    /** Last site check per brand: a brand can't make us fetch a site more often than this. */
    private final Map<UUID, Long> lastCheck = new ConcurrentHashMap<>();

    BrandSiteService(BrandProfileService profiles, SiteFetcherFactory fetchers, BrandImportProperties properties) {
        this.profiles = profiles;
        this.fetchers = fetchers;
        this.properties = properties;
    }

    /** @param email the brand's login email, from the session */
    Verified verify(UUID brandId, String email) {
        BrandProfile profile = profiles.get(brandId);
        String website = profile.websiteUrl();
        String domain = SiteDomain.of(website);
        if (website == null || domain == null) {
            throw new ApiException(HttpStatus.CONFLICT, ErrorCode.SITE_NOT_SET, "Save the brand's website first");
        }
        SiteVerifier.Method method = null;
        if (properties.emailDomainAllowed()
                && SiteVerifier.emailDomainMatches(email, domain, properties.publicEmailDomainSet())) {
            method = SiteVerifier.Method.EMAIL_DOMAIN;
        } else {
            throttle(brandId);
            PoliteFetcher fetcher = fetchers.forSite(domain, URI.create(website).getHost(), VERIFY_REQUESTS);
            SiteVerifier.Outcome outcome;
            try {
                fetcher.loadRobots();
                outcome = SiteVerifier.checkSite(fetcher, profile.verificationToken());
            } catch (SourceStoppedException e) {
                outcome = new SiteVerifier.Outcome(null, true);
            }
            if (outcome.method() == null) {
                if (outcome.unreachable()) {
                    throw new ApiException(HttpStatus.BAD_GATEWAY, ErrorCode.SITE_UNREACHABLE,
                        "The website could not be read");
                }
                throw new ApiException(HttpStatus.CONFLICT, ErrorCode.SITE_VERIFICATION_FAILED,
                    "Neither the meta tag nor the verification file holds the token");
            }
            method = outcome.method();
        }
        BrandProfile verified = profiles.markSiteVerified(brandId, website)
            .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, ErrorCode.SITE_VERIFICATION_FAILED,
                "The website changed while it was being verified"));
        return new Verified(verified.siteDomain(), verified.siteVerifiedAt(), method);
    }

    private void throttle(UUID brandId) {
        long now = System.currentTimeMillis();
        long minMillis = properties.verifyInterval().toMillis();
        Long previous = lastCheck.put(brandId, now);
        if (previous != null && now - previous < minMillis) {
            lastCheck.put(brandId, previous);
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, ErrorCode.TOO_MANY_REQUESTS,
                "Wait a little before checking the website again");
        }
    }
}
