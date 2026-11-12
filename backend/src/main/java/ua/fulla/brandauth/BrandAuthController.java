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
import ua.fulla.common.PasswordLength;
import ua.fulla.common.SessionAccount;
import ua.fulla.common.SessionAccount.AccountType;
import ua.fulla.common.SessionLogin;
import ua.fulla.common.StrictEmail;

/** Brand register / login / logout (api.md §2.1, US-21, US-21.1). */
@RestController
class BrandAuthController {

    /** The rules are checked only where the parameter is {@code @Valid}: on register, not on login. */
    record CredentialsRequest(@StrictEmail String email, @PasswordLength String password) {

        // Never print the password, e.g. if the record ends up in a log line.
        @Override
        public String toString() {
            return "CredentialsRequest[email=" + email + ", password=***]";
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
    BrandSessionResponse register(@Valid @RequestBody CredentialsRequest body,
            HttpServletRequest request, HttpServletResponse response) {
        attemptLimiter.check(request);
        return startSession(service.register(body.email(), body.password()), request, response);
    }

    /** Not {@code @Valid}: any malformed input is the same 401 as a wrong password (US-21.1 CL). */
    @PostMapping("/api/brand/login")
    BrandSessionResponse login(@RequestBody CredentialsRequest body,
            HttpServletRequest request, HttpServletResponse response) {
        attemptLimiter.check(request);
        return startSession(service.login(body.email(), body.password()), request, response);
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
