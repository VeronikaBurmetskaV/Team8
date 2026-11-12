package ua.fulla.common;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;

/**
 * Access rules, CSRF and the 401/403 envelopes (ADR-0006).
 * Login itself is added by the brandauth and buyer features.
 */
@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, SecurityContextRepository contextRepository)
            throws Exception {
        http
            .securityContext(context -> context.securityContextRepository(contextRepository))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/brand/register", "/api/brand/login").permitAll()
                .requestMatchers("/api/brand/**").hasRole("BRAND")
                .requestMatchers("/api/me/**").hasRole("BUYER")
                .anyRequest().permitAll())
            // XSRF-TOKEN cookie -> X-XSRF-TOKEN header, read by frontend/src/api/client.ts
            .csrf(csrf -> csrf.spa())
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, e) ->
                    writeError(response, HttpServletResponse.SC_UNAUTHORIZED, ErrorCode.UNAUTHENTICATED,
                        "Authentication required"))
                .accessDeniedHandler((request, response, e) ->
                    writeError(response, HttpServletResponse.SC_FORBIDDEN, ErrorCode.FORBIDDEN,
                        "Access denied or missing CSRF token")));
        return http.build();
    }

    /** Where the login lives: the HTTP session. One bean for the filter chain and {@link SessionLogin}. */
    @Bean
    SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    /** BCrypt for both account tables (ADR-0006, NFR-03). */
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // Security errors happen before any controller, so @RestControllerAdvice can't see them.
    private static void writeError(HttpServletResponse response, int status, ErrorCode code, String message)
            throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(
            "{\"error\":{\"code\":\"" + code.name() + "\",\"message\":\"" + message + "\"}}");
    }
}
