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
import ua.fulla.common.BuyerLogin;
import ua.fulla.common.DisplayName;

/** Buyer registration (api.md §2.3, US-02). Login and logout (US-03) are not built yet. */
@RestController
class BuyerAuthController {

    /**
     * US-02, ADR-0016: the fields in form order — the required name, «Email або номер телефону»
     * (one field; the server decides which it is and normalizes it), the password.
     */
    record RegisterRequest(
            @DisplayName(required = true) String name,
            @BuyerLogin String login,
            @PasswordLength String password) {

        // Never print the password, e.g. if the record ends up in a log line.
        @Override
        public String toString() {
            return "RegisterRequest[name=" + name + ", login=" + login + ", password=***]";
        }
    }

    /** The new session: the email or the phone (the other one null) and the name, if given. */
    record BuyerSessionResponse(String email, String phone, String name) {}

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
    BuyerSessionResponse register(@Valid @RequestBody RegisterRequest body,
            HttpServletRequest request, HttpServletResponse response) {
        attemptLimiter.check(request);
        RegisteredBuyer buyer = service.register(body.login(), body.password(), body.name());
        // The session principal carries the login (GET /api/session «email» is the phone for a
        // phone account).
        sessionLogin.login(request, response, new SessionAccount(AccountType.BUYER, buyer.buyerId(), buyer.login()));
        return new BuyerSessionResponse(buyer.email(), buyer.phone(), buyer.name());
    }
}
