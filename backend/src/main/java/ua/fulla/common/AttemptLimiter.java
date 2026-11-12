package ua.fulla.common;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Simple in-memory limit of login/register attempts per IP address (ADR-0006, api.md §3.2).
 * One counter per IP is shared by all login and register endpoints. The minute starts with
 * the first attempt; every attempt counts, successful or not.
 */
@Component
public class AttemptLimiter {

    static final long WINDOW_MILLIS = 60_000;
    /** Above this many tracked addresses, finished windows are thrown away. */
    static final int CLEANUP_SIZE = 10_000;

    private record Window(long startedAt, int attempts) {}

    private final int maxPerMinute;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    AttemptLimiter(@Value("${fulla.auth.max-attempts-per-minute}") int maxPerMinute) {
        this.maxPerMinute = maxPerMinute;
    }

    /** Counts one attempt of the caller; throws 429 TOO_MANY_REQUESTS when the limit is exceeded. */
    public void check(HttpServletRequest request) {
        check(request.getRemoteAddr(), System.currentTimeMillis());
    }

    void check(String ip, long now) {
        if (windows.size() > CLEANUP_SIZE) {
            windows.values().removeIf(window -> now - window.startedAt() >= WINDOW_MILLIS);
        }
        // merge() is atomic per key, so parallel requests from one IP are counted correctly.
        Window window = windows.merge(ip, new Window(now, 1), (old, fresh) ->
            now - old.startedAt() >= WINDOW_MILLIS ? fresh : new Window(old.startedAt(), old.attempts() + 1));
        if (window.attempts() > maxPerMinute) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, ErrorCode.TOO_MANY_REQUESTS,
                "Too many login or register attempts, try again in a minute");
        }
    }
}
