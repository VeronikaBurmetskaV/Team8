package ua.fulla.common;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** «Email або номер телефону» of a buyer: {@link LoginId#parse} must accept it (US-02). */
@Target({ElementType.FIELD, ElementType.RECORD_COMPONENT, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = BuyerLogin.Validator.class)
public @interface BuyerLogin {

    String message() default "LOGIN_INVALID: login must be an email or a phone number (+380…)";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    class Validator implements ConstraintValidator<BuyerLogin, String> {
        @Override
        public boolean isValid(String login, ConstraintValidatorContext context) {
            return LoginId.parse(login) != null;
        }
    }
}
