package ua.fulla.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/** The counting rules of the login/register limit (ADR-0006), without Spring. */
class AttemptLimiterTest {

    static final long START = 1_000_000;

    final AttemptLimiter limiter = new AttemptLimiter(10);

    @Test
    void eleventhAttemptWithinAMinuteIsRefused() {
        for (int i = 0; i < 10; i++) {
            limiter.check("10.0.0.1", START + i);
        }

        ApiException refused = catchThrowableOfType(ApiException.class,
            () -> limiter.check("10.0.0.1", START + AttemptLimiter.WINDOW_MILLIS - 1));

        assertThat(refused.status()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(refused.code()).isEqualTo(ErrorCode.TOO_MANY_REQUESTS);
    }

    @Test
    void attemptsAreCountedPerAddress() {
        for (int i = 0; i < 10; i++) {
            limiter.check("10.0.0.1", START);
        }

        assertThatCode(() -> limiter.check("10.0.0.2", START)).doesNotThrowAnyException();
    }

    @Test
    void aNewMinuteStartsANewCount() {
        for (int i = 0; i < 10; i++) {
            limiter.check("10.0.0.1", START);
        }

        long minuteLater = START + AttemptLimiter.WINDOW_MILLIS;
        for (int i = 0; i < 10; i++) {
            limiter.check("10.0.0.1", minuteLater);
        }
        assertThat(catchThrowableOfType(ApiException.class, () -> limiter.check("10.0.0.1", minuteLater + 1)))
            .as("the 11th attempt of the new minute").isNotNull();
    }
}
