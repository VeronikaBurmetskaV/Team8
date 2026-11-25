package ua.fulla.common;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * The brand's website (US-21, US-22.1): an {@code https://} URL with a domain name
 * ({@code name.tld}), at most 2048 characters, see {@link WebsiteUrlValidator}. The server only
 * stores it and never requests it (A-15). The message is "ERROR_CODE: developer text".
 */
@Target({ElementType.FIELD, ElementType.RECORD_COMPONENT, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = WebsiteUrlValidator.class)
public @interface WebsiteUrl {

    /** Registration requires the website; in the profile {@code null} is allowed. */
    boolean required() default false;

    String message() default "PROFILE_INVALID: websiteUrl must be an https:// URL with a domain, at most 2048 characters";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
