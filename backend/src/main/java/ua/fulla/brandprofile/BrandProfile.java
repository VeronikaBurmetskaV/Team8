package ua.fulla.brandprofile;

import java.time.Instant;
import java.util.UUID;

/** A row of {@code brand_profiles} (data-model.md §2.2). */
public record BrandProfile(
        UUID brandId,
        String name,
        UUID logoImageId,
        String logoUrl,
        Instant consentGivenAt,
        String consentText,
        Instant createdAt,
        Instant updatedAt) {

    /** The state is derived, not stored (domain-model.md §4.1). */
    public ProfileState state() {
        if (name == null) {
            return ProfileState.INCOMPLETE;
        }
        return consentGivenAt == null ? ProfileState.ACTIVE : ProfileState.CONSENTED;
    }
}
