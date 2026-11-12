package ua.fulla.products;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * The product name: 1–100 characters after trimming, no control characters (US-25.1 CL).
 * The message is "ERROR_CODE: developer text", see ApiExceptionHandler.
 */
@Target({ElementType.FIELD, ElementType.RECORD_COMPONENT, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = CardNameValidator.class)
@interface CardName {

    String message() default "CARD_INVALID_NAME: name must be 1-100 characters without control characters";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
