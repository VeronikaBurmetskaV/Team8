package ua.fulla.common;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** @WebsiteUrl with the same examples as the frontend (validation.examples.json, «websiteUrl»). */
class WebsiteUrlValidatorTest {

    @Test
    void sharedExamples() {
        ValidationExamples.websiteUrl(true)
            .forEach(url -> assertThat(WebsiteUrlValidator.isWebsite(url)).as(url).isTrue());
        ValidationExamples.websiteUrl(false)
            .forEach(url -> assertThat(WebsiteUrlValidator.isWebsite(url)).as(url).isFalse());
    }

    @Test
    void sharedNormalizationExamples() {
        assertThat(ValidationExamples.websiteUrlNormalized()).isNotEmpty();
        ValidationExamples.websiteUrlNormalized().forEach(example ->
            assertThat(WebsiteUrlValidator.normalize(example.value())).as(example.value())
                .isEqualTo(example.normalized()));
    }

    @Test
    void lengthIsCheckedAfterTheTrackingParametersAreRemoved() {
        String path = "https://brand.ua/" + "a".repeat(2000);
        assertThat(WebsiteUrlValidator.isWebsite(path + "?srsltid=" + "x".repeat(100))).isTrue();
        assertThat(WebsiteUrlValidator.isWebsite(path + "?lang=" + "x".repeat(100))).isFalse();
    }

    @Test
    void surroundingSpacesAreIgnoredAndRemoved() {
        assertThat(WebsiteUrlValidator.isWebsite("  https://brand.com.ua ")).isTrue();
        assertThat(WebsiteUrlValidator.normalize("  https://brand.com.ua ")).isEqualTo("https://brand.com.ua");
    }
}
