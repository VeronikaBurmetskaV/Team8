package ua.fulla.brandauth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ua.fulla.brandauth.BrandAuthService.AuthenticatedBrand;
import ua.fulla.brandprofile.ProfileState;
import ua.fulla.common.AttemptLimiter;
import ua.fulla.common.BrandName;
import ua.fulla.common.DisplayName;
import ua.fulla.common.PasswordLength;
import ua.fulla.common.SessionAccount;
import ua.fulla.common.SessionAccount.AccountType;
import ua.fulla.common.SessionLogin;
import ua.fulla.common.StrictEmail;
import ua.fulla.common.WebsiteUrl;

/** Brand register / login / logout (api.md §2.1, US-21, US-21.1). */
@RestController
class BrandAuthController {

    private static final String CONTACT_NAME_INVALID =
        "VALIDATION_FAILED: contactName must be 1-50 characters without control characters";

    /**
     * Login: brand name + email + password (2026-12-02). Not {@code @Valid}: the service checks
     * email → password → brand name and answers 401 with the first failing field (ADR-0018).
     */
    record CredentialsRequest(String brandName, @StrictEmail String email, @PasswordLength String password) {

        // Never print the password, e.g. if the record ends up in a log line.
        @Override
        public String toString() {
            return "CredentialsRequest[brandName=" + brandName + ", email=" + email + ", password=***]";
        }
    }

    /**
     * Registration (US-21): the fields in form order — contact name, brand name, website, email,
     * password — so the top-level error code is the first wrong field (api.md §3.1). The contact
     * person («Ваше імʼя») is required, 1–50 characters (VALIDATION_FAILED with fields.contactName);
     * name and website have the profile's rules (PROFILE_INVALID with fields.name / fields.websiteUrl).
     */
    record RegisterRequest(
            @DisplayName(required = true, message = CONTACT_NAME_INVALID) String contactName,
            @BrandName String name,
            @WebsiteUrl(required = true) String websiteUrl,
            @StrictEmail String email,
            @PasswordLength String password) {

        // Never print the password, e.g. if the record ends up in a log line.
        @Override
        public String toString() {
            return "RegisterRequest[contactName=" + contactName + ", name=" + name + ", websiteUrl=" + websiteUrl
                + ", email=" + email
                + ", password=***]";
        }
    }

    record BrandSessionResponse(UUID brandId, String email, ProfileState profileState) {}

    private final BrandAuthService service;
    private final SessionLogin sessionLogin;
    private final AttemptLimiter attemptLimiter;

    BrandAuthController(BrandAuthService service, SessionLogin sessionLogin, AttemptLimiter attemptLimiter) {
        this.service = service;
        this.sessionLogin = sessionLogin;
        this.attemptLimiter = attemptLimiter;
    }

    /** Register = create + log in (ADR-0006). */
    @PostMapping("/api/brand/register")
    @ResponseStatus(HttpStatus.CREATED)
    BrandSessionResponse register(@Valid @RequestBody RegisterRequest body,
            HttpServletRequest request, HttpServletResponse response) {
        attemptLimiter.check(request);
        return startSession(service.register(body.email(), body.password(), body.contactName(), body.name(),
                body.websiteUrl()),
            request, response);
    }

    /** Not {@code @Valid}: a malformed email is EMAIL_NOT_FOUND like an unknown one (ADR-0018). */
    @PostMapping("/api/brand/login")
    BrandSessionResponse login(@RequestBody CredentialsRequest body,
            HttpServletRequest request, HttpServletResponse response) {
        attemptLimiter.check(request);
        return startSession(service.login(body.brandName(), body.email(), body.password()), request, response);
    }

    @PostMapping("/api/brand/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void logout(HttpServletRequest request) {
        sessionLogin.logout(request);
    }

    private BrandSessionResponse startSession(AuthenticatedBrand brand,
            HttpServletRequest request, HttpServletResponse response) {
        sessionLogin.login(request, response, new SessionAccount(AccountType.BRAND, brand.brandId(), brand.email()));
        return new BrandSessionResponse(brand.brandId(), brand.email(), brand.profileState());
    }
}
