package ua.fulla.common;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;
import tools.jackson.databind.json.JsonMapper;

/**
 * The URL examples shared with the frontend (R-T17, final-review №6). Vitest and JUnit read the
 * same file, frontend/src/shared/validation.examples.json, so the two sides cannot drift apart.
 */
public final class ValidationExamples {

    /** Maven runs the tests in backend/, so the frontend is one level up. */
    static final Path FILE = Path.of("..", "frontend", "src", "shared", "validation.examples.json");

    public record Example(String value, boolean valid) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record ExamplesFile(List<Example> httpUrl, List<Example> httpsUrl, List<Example> websiteUrl,
            List<NormalizedExample> websiteUrlNormalized, List<LoginExample> loginId) {}

    /** What the website becomes before it is checked and saved (WebsiteUrlValidator.normalize). */
    public record NormalizedExample(String value, String normalized) {}

    /** «Email або номер телефону»: the kind and the normalized value, or null for both = invalid. */
    public record LoginExample(String value, String kind, String normalized) {}

    private static final ExamplesFile EXAMPLES = read();

    private ValidationExamples() {}

    /** Examples for @HttpUrl (the product link). */
    public static Stream<String> httpUrl(boolean valid) {
        return values(EXAMPLES.httpUrl(), valid);
    }

    /** Examples for @HttpsUrl (photo and logo URL). */
    public static Stream<String> httpsUrl(boolean valid) {
        return values(EXAMPLES.httpsUrl(), valid);
    }

    /** Examples for LoginId.parse (the buyer's email or phone, ADR-0016). */
    public static List<LoginExample> loginId() {
        return EXAMPLES.loginId();
    }

    /** Examples for @WebsiteUrl (the brand's website, US-21). */
    public static Stream<String> websiteUrl(boolean valid) {
        return values(EXAMPLES.websiteUrl(), valid);
    }

    /** Examples for WebsiteUrlValidator.normalize (tracking parameters removed). */
    public static List<NormalizedExample> websiteUrlNormalized() {
        return EXAMPLES.websiteUrlNormalized();
    }

    private static Stream<String> values(List<Example> examples, boolean valid) {
        return examples.stream().filter(example -> example.valid() == valid).map(Example::value);
    }

    private static ExamplesFile read() {
        try {
            return JsonMapper.builder().build().readValue(Files.readString(FILE), ExamplesFile.class);
        } catch (IOException e) {
            throw new UncheckedIOException("cannot read " + FILE.toAbsolutePath(), e);
        }
    }
}
