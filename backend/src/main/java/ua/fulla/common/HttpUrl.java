package ua.fulla.common;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * A link to a brand's page: parses as a {@code java.net.URI} with scheme {@code http} or
 * {@code https} and a non-empty host (US-26 CL, T-12). {@code null} is valid; add {@code @NotNull}.
 * Give the message as "ERROR_CODE: developer text", see {@link ApiExceptionHandler}.
 */
@Target({ElementType.FIELD, ElementType.RECORD_COMPONENT, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = HttpUrlValidator.class)
public @interface HttpUrl {

    String message() default "VALIDATION_FAILED: must be an absolute http:// or https:// URL";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
