package ua.fulla.products;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.util.regex.Pattern;
import ua.fulla.common.UnicodeText;

public class CardNameValidator implements ConstraintValidator<CardName, String> {

    static final int NAME_MIN = 1;
    static final int NAME_MAX = 100;
    /** Control characters such as U+0000 are invisible, and Postgres cannot store U+0000 at all. */
    static final Pattern CONTROL = Pattern.compile("\\p{Cc}");

    @Override
    public boolean isValid(String rawName, ConstraintValidatorContext context) {
        String name = normalize(rawName);
        // Code points, like char_length() in the database CHECK
        int length = name.codePointCount(0, name.length());
        return length >= NAME_MIN && length <= NAME_MAX && !CONTROL.matcher(name).find();
    }

    /** The name as it is validated and saved: trimmed, including non-breaking spaces. */
    static String normalize(String rawName) {
        return rawName == null ? "" : UnicodeText.trim(rawName);
    }
}
