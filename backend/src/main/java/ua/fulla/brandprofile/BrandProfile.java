package ua.fulla.brandprofile;

import java.time.Instant;
import java.util.UUID;
import ua.fulla.common.SiteDomain;

/** A row of {@code brand_profiles} (data-model.md §2.2). */
public record BrandProfile(
        UUID brandId,
        String contactName,
        String name,
        UUID logoImageId,
        String logoUrl,
        String websiteUrl,
        Instant consentGivenAt,
        String consentText,
        String verificationToken,
        Instant siteVerifiedAt,
        String siteDomain,
        String feedUrl,
        Instant createdAt,
        Instant updatedAt) {

    /**
     * ADR-0017: the site counts as verified only while {@code websiteUrl} still points to the
     * verified domain (the profile update clears the verification on a domain change anyway).
     */
    public boolean siteVerified() {
        return siteVerifiedAt != null && siteDomain != null && siteDomain.equals(SiteDomain.of(websiteUrl));
    }

    /** The state is derived, not stored (domain-model.md §4.1). */
    public ProfileState state() {
        if (name == null) {
            return ProfileState.INCOMPLETE;
        }
        return consentGivenAt == null ? ProfileState.ACTIVE : ProfileState.CONSENTED;
    }
}
