package ua.fulla.common;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.nio.charset.StandardCharsets;

public class PasswordLengthValidator implements ConstraintValidator<PasswordLength, String> {

    static final int MIN_CHARACTERS = 8;
    /**
     * BCrypt reads only the first 72 bytes and Spring's encoder refuses longer passwords (Q-11).
     * Bytes, not characters: a Cyrillic letter takes 2 bytes, so the limit is 36 such letters.
     */
    static final int MAX_BYTES = 72;

    @Override
    public boolean isValid(String password, ConstraintValidatorContext context) {
        return password != null && password.length() >= MIN_CHARACTERS && fitsBcrypt(password);
    }

    /** Also used by login: a longer password cannot match any stored hash. */
    public static boolean fitsBcrypt(String password) {
        return password.getBytes(StandardCharsets.UTF_8).length <= MAX_BYTES;
    }
}
