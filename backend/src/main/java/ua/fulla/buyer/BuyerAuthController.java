package ua.fulla.buyer;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ua.fulla.buyer.BuyerAuthService.RegisteredBuyer;
import ua.fulla.common.AttemptLimiter;
import ua.fulla.common.PasswordLength;
import ua.fulla.common.SessionAccount;
import ua.fulla.common.SessionAccount.AccountType;
import ua.fulla.common.SessionLogin;
import ua.fulla.common.StrictEmail;

/** Buyer registration (api.md §2.3, US-02). Login and logout (US-03) are not built yet. */
@RestController
class BuyerAuthController {

    record CredentialsRequest(@StrictEmail String email, @PasswordLength String password) {

        // Never print the password, e.g. if the record ends up in a log line.
        @Override
        public String toString() {
            return "CredentialsRequest[email=" + email + ", password=***]";
        }
    }

    record BuyerSessionResponse(String email) {}

    private final BuyerAuthService service;
    private final SessionLogin sessionLogin;
    private final AttemptLimiter attemptLimiter;

    BuyerAuthController(BuyerAuthService service, SessionLogin sessionLogin, AttemptLimiter attemptLimiter) {
        this.service = service;
        this.sessionLogin = sessionLogin;
        this.attemptLimiter = attemptLimiter;
    }

    /** Register = create + log in with ROLE_BUYER (ADR-0006); any earlier login in this browser is replaced. */
    @PostMapping("/api/buyer/register")
    @ResponseStatus(HttpStatus.CREATED)
    BuyerSessionResponse register(@Valid @RequestBody CredentialsRequest body,
            HttpServletRequest request, HttpServletResponse response) {
        attemptLimiter.check(request);
        RegisteredBuyer buyer = service.register(body.email(), body.password());
        sessionLogin.login(request, response, new SessionAccount(AccountType.BUYER, buyer.buyerId(), buyer.email()));
        return new BuyerSessionResponse(buyer.email());
    }
}
