package ua.fulla.catalogimport;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;

/** Saved samples in src/test/resources/catalogimport: the tests never call the real sites. */
final class Fixtures {

    private Fixtures() {}

    static InputStream stream(String name) {
        InputStream in = Fixtures.class.getResourceAsStream("/catalogimport/" + name);
        if (in == null) {
            throw new IllegalArgumentException("No fixture " + name);
        }
        return in;
    }

    static String text(String name) {
        try (InputStream in = stream(name)) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
