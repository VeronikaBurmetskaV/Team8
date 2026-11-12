package ua.fulla.common;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * A new password: at least 8 characters and at most 72 bytes in UTF-8 (US-21 CL, Q-11).
 * The message is "ERROR_CODE: developer text", see {@link ApiExceptionHandler}.
 */
@Target({ElementType.FIELD, ElementType.RECORD_COMPONENT, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = PasswordLengthValidator.class)
public @interface PasswordLength {

    String message() default
        "PASSWORD_TOO_SHORT: password must be at least 8 characters and at most 72 bytes in UTF-8";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
