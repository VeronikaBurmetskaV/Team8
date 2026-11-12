package ua.fulla.common;

/** Text helpers shared by the validators. */
public final class UnicodeText {

    private UnicodeText() {}

    /**
     * Trims like {@link String#strip()}, but also removes Unicode separators such as the
     * non-breaking space (U+00A0), which strip() and btrim() in the database leave in place.
     */
    public static String trim(String value) {
        return value.replaceAll("^[\\s\\p{Z}]+|[\\s\\p{Z}]+$", "");
    }
}
