package ua.fulla.common;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.util.regex.Pattern;

/**
 * A person's name (the buyer's «Імʼя», US-02): 1–50 characters after trimming, no control
 * characters. With {@code required = false} null or blank means "no name".
 */
@Target({ElementType.FIELD, ElementType.RECORD_COMPONENT, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = DisplayName.Validator.class)
public @interface DisplayName {

    int MAX = 50;

    /** Registration requires the name (ADR-0016, revised 2026-11-28). */
    boolean required() default false;

    String message() default "VALIDATION_FAILED: name must be 1-50 characters without control characters";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    class Validator implements ConstraintValidator<DisplayName, String> {
        private static final Pattern CONTROL = Pattern.compile("\\p{Cc}");

        private boolean required;

        @Override
        public void initialize(DisplayName annotation) {
            this.required = annotation.required();
        }

        /** The name as stored: trimmed; null when nothing is left. */
        public static String normalize(String raw) {
            if (raw == null) {
                return null;
            }
            String name = UnicodeText.trim(raw);
            return name.isEmpty() ? null : name;
        }

        @Override
        public boolean isValid(String raw, ConstraintValidatorContext context) {
            String name = normalize(raw);
            if (name == null) {
                return !required;
            }
            return (name.codePointCount(0, name.length()) <= DisplayName.MAX && !CONTROL.matcher(name).find());
        }
    }
}
