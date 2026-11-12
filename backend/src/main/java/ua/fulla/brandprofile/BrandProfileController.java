package ua.fulla.brandprofile;

import jakarta.validation.Valid;
import java.time.Instant;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import ua.fulla.common.HttpsUrl;
import ua.fulla.common.SessionAccount;

/** {@code /api/brand/profile} (api.md §2.1); ROLE_BRAND is required by SecurityConfig. */
@RestController
class BrandProfileController {

    /**
     * The documented request shape. Only {@code name} is saved so far (US-22.1). Until the logo
     * is stored, a non-null logo is refused by {@link BrandProfileService#save}
     * ({@code 400 PROFILE_INVALID}, {@code fields.logo}); {@code consentGiven} is not processed
     * until US-22.2.
     */
    record ProfileRequest(
            @BrandName String name,
            UUID logoImageId,
            @HttpsUrl(message = "PROFILE_INVALID: logoUrl must be an https:// URL") String logoUrl,
            Boolean consentGiven) {}

    record ProfileResponse(
            String name,
            UUID logoImageId,
            String logoUrl,
            boolean consentGiven,
            String logoDisplayUrl,
            Instant consentGivenAt,
            String consentText,
            ProfileState state) {

        static ProfileResponse of(BrandProfile profile) {
            String logoDisplayUrl = profile.logoImageId() != null
                ? "/api/images/" + profile.logoImageId()
                : profile.logoUrl();
            return new ProfileResponse(
                profile.name(),
                profile.logoImageId(),
                profile.logoUrl(),
                profile.consentGivenAt() != null,
                logoDisplayUrl,
                profile.consentGivenAt(),
                profile.consentText(),
                profile.state());
        }
    }

    private final BrandProfileService service;

    BrandProfileController(BrandProfileService service) {
        this.service = service;
    }

    @GetMapping("/api/brand/profile")
    ProfileResponse get(@AuthenticationPrincipal SessionAccount brand) {
        return ProfileResponse.of(service.get(brand.accountId()));
    }

    @PutMapping("/api/brand/profile")
    ProfileResponse save(@AuthenticationPrincipal SessionAccount brand, @Valid @RequestBody ProfileRequest request) {
        return ProfileResponse.of(
            service.save(brand.accountId(), request.name(), request.logoImageId(), request.logoUrl()));
    }
}
