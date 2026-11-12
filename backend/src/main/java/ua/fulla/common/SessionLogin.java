package ua.fulla.common;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Component;

/**
 * Manual login/logout for the login controllers (ADR-0006): there is no UserDetailsService,
 * each feature checks the password against its own table and then calls {@link #login}.
 */
@Component
public class SessionLogin {

    private final SecurityContextRepository contextRepository;

    /** @param contextRepository the same bean the filter chain reads the login from (SecurityConfig) */
    SessionLogin(SecurityContextRepository contextRepository) {
        this.contextRepository = contextRepository;
    }

    /** Starts a fresh session for the account; any earlier login in this browser is replaced. */
    public void login(HttpServletRequest request, HttpServletResponse response, SessionAccount account) {
        // A new session = a new session ID (no session fixation) and nothing left of the old login.
        HttpSession old = request.getSession(false);
        if (old != null) {
            old.invalidate();
        }
        request.getSession(true);

        var authority = new SimpleGrantedAuthority("ROLE_" + account.accountType().name());
        var authentication = UsernamePasswordAuthenticationToken.authenticated(account, null, List.of(authority));
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        // Spring Security does not save the context by itself for a manual login.
        contextRepository.saveContext(context, request, response);
    }

    public void logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
    }
}
