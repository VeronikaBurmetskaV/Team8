package ua.fulla.brandprofile;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ua.fulla.common.ApiException;
import ua.fulla.common.BrandNameValidator;
import ua.fulla.common.ErrorCode;
import ua.fulla.common.SiteDomain;
import ua.fulla.common.WebsiteUrlValidator;

@Service
public class BrandProfileService {

    /**
     * The consent checkbox label, exactly as shown in the cabinet (US-22.2 CL). Stored with the
     * consent (A-17), so the text is fixed by the server, never taken from the request.
     */
    static final String CONSENT_TEXT =
        "Я надаю згоду платформі FULLA на демонстрацію логотипа, фотографій та інформації про товари мого бренду";

    private static final Logger log = LoggerFactory.getLogger(BrandProfileService.class);

    /** Constraint of brand_profiles (data-model.md) → the request field that is to blame. */
    private static final Map<String, String> CONSTRAINT_FIELDS = Map.of(
        "brand_profiles_name_length", "name",
        "brand_profiles_consent_needs_name", "name",
        "brand_profiles_website_url_https", "websiteUrl",
        "brand_profiles_feed_url_https", "feedUrl",
        "brand_profiles_logo_url_https", "logo",
        "brand_profiles_one_logo_source", "logo",
        "brand_profiles_logo_image_fk", "logo",
        "brand_profiles_consent_pair", "consentGiven");
    private static final Pattern CONSTRAINT = Pattern.compile("constraint \"([a-z_]+)\"");
    private static final Pattern TOO_LONG = Pattern.compile("character varying\\((\\d+)\\)");

    private final BrandProfileRepository repository;

    BrandProfileService(BrandProfileRepository repository) {
        this.repository = repository;
    }

    /**
     * Called by brand registration inside its transaction (T-9): the profile starts with the name
     * and website entered at registration (US-21), already checked by Bean Validation
     * (@BrandName, @WebsiteUrl). With a name the state is ACTIVE (domain-model.md §4.1).
     */
    @Transactional
    public BrandProfile create(UUID brandId, String rawName, String websiteUrl) {
        writing(() -> {
            repository.insert(brandId, BrandNameValidator.normalize(rawName),
                WebsiteUrlValidator.normalize(websiteUrl));
            return null;
        });
        return get(brandId);
    }

    public BrandProfile get(UUID brandId) {
        return repository.findByBrandId(brandId).orElseThrow(() -> missingProfile(brandId));
    }

    /**
     * Saves the brand name (US-22.1 CL) and records the consent (US-22.2); the name format and the
     * logo URL are already checked by Bean Validation on the request record.
     *
     * <p>Consent is one-way for the brand (INV-09, T-5): {@code consentGiven=true} records the time
     * and {@link #CONSENT_TEXT} once, in the same {@code UPDATE} as the name, and never moves them;
     * {@code consentGiven=false} after consent was given is refused with {@code 409 CONSENT_LOCKED}
     * and nothing is saved. Only the operator ({@code ops}) withdraws consent (T-6).
     *
     * <p>The logo is not implemented yet (final-review №3): instead of answering 200 and silently
     * dropping it, any logo is refused with {@code 400 PROFILE_INVALID}, {@code fields.logo}, and
     * nothing is saved. Remove this check when the logo is stored.
     */
    @Transactional
    public BrandProfile save(UUID brandId, String rawName, String websiteUrl, String feedUrl, UUID logoImageId,
            String logoUrl, Boolean consentGiven) {
        // A rule across two fields: a logo is an uploaded image or an external URL, never both.
        if (logoImageId != null && logoUrl != null) {
            // Map.of has no order; the two fields carry the same code anyway.
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.PROFILE_INVALID,
                "give either logoImageId or logoUrl, not both",
                Map.of("logoImageId", ErrorCode.PROFILE_INVALID, "logoUrl", ErrorCode.PROFILE_INVALID));
        }
        if (logoImageId != null || (logoUrl != null && !logoUrl.isEmpty())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.PROFILE_INVALID,
                "the logo is not supported yet; send logoImageId and logoUrl as null",
                Map.of("logo", ErrorCode.PROFILE_INVALID));
        }
        if (Boolean.FALSE.equals(consentGiven) && get(brandId).consentGivenAt() != null) {
            throw new ApiException(HttpStatus.CONFLICT, ErrorCode.CONSENT_LOCKED,
                "consent was already given and cannot be withdrawn by the brand");
        }
        String name = BrandNameValidator.normalize(rawName);
        boolean giveConsent = Boolean.TRUE.equals(consentGiven);
        String website = WebsiteUrlValidator.normalize(websiteUrl);
        String feed = feedUrl == null || feedUrl.isBlank() ? null : feedUrl.strip();
        // ADR-0017: the feed is read only from the brand's own (verified) domain.
        if (feed != null && (website == null || !SiteDomain.covers(SiteDomain.of(website), hostOf(feed)))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.PROFILE_INVALID,
                "feedUrl must be on the domain of websiteUrl", Map.of("feedUrl", ErrorCode.PROFILE_INVALID));
        }
        // The website and the feed are replaced like the name; null clears them (optional in the
        // profile). A website on another domain clears the site verification (ADR-0017).
        return writing(() -> repository.updateNameAndConsent(brandId, name, website, feed, giveConsent,
                CONSENT_TEXT))
            .orElseThrow(() -> missingProfile(brandId));
    }

    /**
     * ADR-0017: stores a successful ownership check of {@code websiteUrl} (the value that was
     * checked). Empty when the brand changed its website while the check was running.
     */
    @Transactional
    public Optional<BrandProfile> markSiteVerified(UUID brandId, String websiteUrl) {
        return repository.markSiteVerified(brandId, websiteUrl, SiteDomain.of(websiteUrl));
    }

    private static String hostOf(String url) {
        try {
            return new URI(url).getHost();
        } catch (URISyntaxException e) {
            return null;
        }
    }

    /**
     * Runs a write of the profile row. Bean Validation checks the same rules first, so a database
     * constraint should never fail; if one does (a rule that drifted, data from an old version),
     * the brand gets {@code 400 PROFILE_INVALID} on the field it belongs to instead of a 500, and
     * the log keeps the full stack trace. A duplicate key is not the brand's input: rethrown.
     */
    private <T> T writing(Supplier<T> write) {
        try {
            return write.get();
        } catch (DuplicateKeyException e) {
            throw e;
        } catch (DataIntegrityViolationException e) {
            String field = blamedField(e);
            log.warn("brand_profiles constraint failed, answered 400 on field {}", field, e);
            if (field == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.PROFILE_INVALID,
                    "the profile breaks a database rule");
            }
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.PROFILE_INVALID,
                "the profile breaks a database rule on " + field, Map.of(field, ErrorCode.PROFILE_INVALID));
        }
    }

    /** The field behind a constraint name or a «value too long» error; null when unknown. */
    static String blamedField(DataIntegrityViolationException e) {
        String message = String.valueOf(e.getMostSpecificCause().getMessage());
        Matcher constraint = CONSTRAINT.matcher(message);
        if (constraint.find()) {
            return CONSTRAINT_FIELDS.get(constraint.group(1));
        }
        Matcher tooLong = TOO_LONG.matcher(message);
        if (tooLong.find()) {
            // name is varchar(50); website_url and logo_url are varchar(2048), and the logo URL
            // is refused before any write while the logo is not stored.
            return tooLong.group(1).equals("50") ? "name" : "websiteUrl";
        }
        return null;
    }

    // Registration always creates the profile row (T-9), so this is a broken-data case, not a 404.
    private static IllegalStateException missingProfile(UUID brandId) {
        return new IllegalStateException("Brand account " + brandId + " has no profile row");
    }
}
