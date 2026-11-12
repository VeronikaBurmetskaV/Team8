package ua.fulla.products;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * A card photo is an uploaded image or an {@code https://} URL, exactly one of the two (US-25.1 CL).
 * A rule across two fields, so it sits on the request record; the error is reported on both
 * photo fields, so ApiExceptionHandler puts it in form order together with the other field errors.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = OnePhotoSourceValidator.class)
@interface OnePhotoSource {

    String message() default "CARD_INVALID_PRICE_OR_PHOTO: give exactly one of photoImageId or photoUrl";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
