package ua.fulla.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Locale;
import org.junit.jupiter.api.Test;

/** LoginId.parse with the same examples as parseLoginId on the frontend (validation.examples.json). */
class LoginIdTest {

    @Test
    void sharedExamples() {
        assertThat(ValidationExamples.loginId()).isNotEmpty();
        for (ValidationExamples.LoginExample example : ValidationExamples.loginId()) {
            LoginId parsed = LoginId.parse(example.value());
            if (example.normalized() == null) {
                assertThat(parsed).as(example.value()).isNull();
            } else {
                assertThat(parsed).as(example.value()).isNotNull();
                assertThat(parsed.kind().name().toLowerCase(Locale.ROOT)).as(example.value()).isEqualTo(example.kind());
                assertThat(parsed.value()).as(example.value()).isEqualTo(example.normalized());
            }
        }
    }

    @Test
    void everyPhoneMatchesTheDatabaseCheck() {
        for (ValidationExamples.LoginExample example : ValidationExamples.loginId()) {
            LoginId parsed = LoginId.parse(example.value());
            if (parsed != null && parsed.kind() == LoginId.Kind.PHONE) {
                assertThat(parsed.value()).matches("^\\+[1-9][0-9]{7,14}$").hasSizeLessThanOrEqualTo(16);
            }
        }
    }
}
