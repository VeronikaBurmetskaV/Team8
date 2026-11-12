package ua.fulla.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * The @HttpsUrl rule for photo and logo URLs (ADR-0007): lowercase https:// and a host. Same
 * examples as isHttpsUrl in the frontend: frontend/src/shared/validation.examples.json (R-T17).
 */
class HttpsUrlValidatorTest {

    final HttpsUrlValidator validator = new HttpsUrlValidator();

    static Stream<String> validUrls() {
        return ValidationExamples.httpsUrl(true);
    }

    static Stream<String> invalidUrls() {
        return ValidationExamples.httpsUrl(false);
    }

    @ParameterizedTest(name = "[{index}] {0}")
    @MethodSource("validUrls")
    void lowercaseHttpsUrlsWithAHostAreValid(String url) {
        assertThat(validator.isValid(url, null)).as(url).isTrue();
    }

    @ParameterizedTest(name = "[{index}] {0}")
    @MethodSource("invalidUrls")
    void everythingElseIsInvalid(String url) {
        assertThat(validator.isValid(url, null)).as(url).isFalse();
    }

    @Test
    void theSharedFileHasBothKindsOfExamples() {
        assertThat(validUrls()).isNotEmpty();
        assertThat(invalidUrls()).isNotEmpty();
    }

    @Test
    void nullIsLeftToNotNull() {
        assertThat(validator.isValid(null, null)).isTrue();
    }
}
