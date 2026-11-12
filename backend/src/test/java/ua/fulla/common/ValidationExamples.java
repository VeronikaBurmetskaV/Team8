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
    record ExamplesFile(List<Example> httpUrl, List<Example> httpsUrl) {}

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
