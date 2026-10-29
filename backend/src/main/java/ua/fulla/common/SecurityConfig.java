package ua.fulla.common;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Access rules, CSRF and the 401/403 envelopes (ADR-0006).
 * Login itself is added by the brandauth and buyer features.
 */
@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
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
