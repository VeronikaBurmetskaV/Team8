package ua.fulla.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * The @HttpUrl rule (US-26 CL, T-12). The examples are frontend/src/shared/validation.examples.json,
 * which the zod tests in validation.test.ts read too (R-T17).
 */
class HttpUrlValidatorTest {

    final HttpUrlValidator validator = new HttpUrlValidator();

    static Stream<String> validUrls() {
        return ValidationExamples.httpUrl(true);
    }

    static Stream<String> invalidUrls() {
        return ValidationExamples.httpUrl(false);
    }

    @ParameterizedTest(name = "[{index}] {0}")
    @MethodSource("validUrls")
    void absoluteHttpAndHttpsUrlsWithAHostAreValid(String url) {
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
