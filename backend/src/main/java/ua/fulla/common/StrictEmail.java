package ua.fulla.common;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * An email of the form {@code name@domain.tld} (US-21 CL, US-02). Checked after normalization,
 * see {@link StrictEmailValidator}. The message is "ERROR_CODE: developer text"; the
 * {@link ApiExceptionHandler} splits it into the code and the message of the error envelope.
 */
@Target({ElementType.FIELD, ElementType.RECORD_COMPONENT, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = StrictEmailValidator.class)
public @interface StrictEmail {

    String message() default "EMAIL_TAKEN_OR_INVALID: email must look like name@domain.tld";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
