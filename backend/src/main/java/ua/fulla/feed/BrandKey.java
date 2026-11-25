package ua.fulla.feed;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * The key that identifies a brand in the catalogue: the same rules as {@code brandKey} in
 * frontend/src/features/catalog/catalog.ts, so the client can match {@code GET /api/brands} with
 * the brands of {@code GET /api/feed}. Apostrophes are unified before NFKC, then invisible
 * characters go, every kind of space becomes one ordinary space, lower case by Ukrainian rules.
 */
final class BrandKey {

    private static final Pattern APOSTROPHES = Pattern.compile("['’‘ʼ‛`´′ʹ]");
    private static final Pattern INVISIBLE = Pattern.compile("[​-‍⁠﻿]");
    /** JavaScript's \s: ASCII whitespace plus every Unicode space separator. */
    private static final Pattern SPACES = Pattern.compile("[\\s\\p{Z}]+");
    private static final Locale UKRAINIAN = Locale.forLanguageTag("uk");

    private BrandKey() {}

    static String of(String name) {
        String unified = APOSTROPHES.matcher(name).replaceAll("'");
        String normalized = Normalizer.normalize(unified, Normalizer.Form.NFKC);
        String visible = INVISIBLE.matcher(normalized).replaceAll("");
        return SPACES.matcher(visible).replaceAll(" ").strip().toLowerCase(UKRAINIAN);
    }
}
