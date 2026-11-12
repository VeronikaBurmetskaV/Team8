package ua.fulla.common;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.util.Locale;
import java.util.regex.Pattern;

/** The email rule and its normalization, for both account types (T-10, T-12). */
public class StrictEmailValidator implements ConstraintValidator<StrictEmail, String> {

    /**
     * {@code name@domain.tld}: one @, at least one dot in the domain, and no whitespace, control
     * characters (\p{Cc}, e.g. U+0000) or Unicode separators (\p{Z}, e.g. U+00A0) anywhere:
     * Postgres cannot store or rejects them, so they must be stopped here (T-12).
     */
    static final Pattern EMAIL = Pattern.compile(
        "^[^@\\s\\p{Cc}\\p{Z}]+@[^@\\s\\p{Cc}\\p{Z}.]+(\\.[^@\\s\\p{Cc}\\p{Z}.]+)+$");
    static final int EMAIL_MAX = 254;

    @Override
    public boolean isValid(String rawEmail, ConstraintValidatorContext context) {
        return isValid(normalize(rawEmail));
    }

    /** T-10: the same normalization before every validation, insert and lookup. */
    public static String normalize(String rawEmail) {
        return rawEmail == null ? "" : UnicodeText.trim(rawEmail).toLowerCase(Locale.ROOT);
    }

    /** @param email an already normalized email */
    public static boolean isValid(String email) {
        return email.length() <= EMAIL_MAX && EMAIL.matcher(email).matches();
    }
}
