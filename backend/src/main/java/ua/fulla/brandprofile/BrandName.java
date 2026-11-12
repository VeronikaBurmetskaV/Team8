package ua.fulla.brandprofile;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * The brand name: 2–50 characters after trimming, no control characters (US-22.1 CL).
 * The message is "ERROR_CODE: developer text", see ApiExceptionHandler.
 */
@Target({ElementType.FIELD, ElementType.RECORD_COMPONENT, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = BrandNameValidator.class)
@interface BrandName {

    String message() default "PROFILE_INVALID: name must be 2-50 characters without control characters";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
