package ua.fulla.common;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** {@code GET /api/session} (api.md §2.2): who is logged in; the response also carries the XSRF-TOKEN cookie. */
@RestController
public class SessionController {

    public record SessionResponse(SessionAccount.AccountType accountType, String email) {}

    @GetMapping("/api/session")
    public SessionResponse session(@AuthenticationPrincipal SessionAccount account) {
        if (account == null) {
            return new SessionResponse(null, null);
        }
        return new SessionResponse(account.accountType(), account.email());
    }
}
