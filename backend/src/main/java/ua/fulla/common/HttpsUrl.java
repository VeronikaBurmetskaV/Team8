package ua.fulla.common;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * An external image URL: {@code https://} only (ADR-0007). {@code null} is valid.
 * Give the message as "ERROR_CODE: developer text", see {@link ApiExceptionHandler}.
 */
@Target({ElementType.FIELD, ElementType.RECORD_COMPONENT, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = HttpsUrlValidator.class)
public @interface HttpsUrl {

    String message() default "VALIDATION_FAILED: must be an https:// URL";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
