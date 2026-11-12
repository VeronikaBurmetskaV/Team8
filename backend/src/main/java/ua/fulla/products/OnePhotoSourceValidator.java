package ua.fulla.products;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import ua.fulla.products.ProductController.CardRequest;

public class OnePhotoSourceValidator implements ConstraintValidator<OnePhotoSource, CardRequest> {

    @Override
    public boolean isValid(CardRequest request, ConstraintValidatorContext context) {
        if (request == null || (request.photoImageId() == null) != (request.photoUrl() == null)) {
            return true;
        }
        // Neither or both: blame the two photo fields instead of the whole request.
        context.disableDefaultConstraintViolation();
        String message = context.getDefaultConstraintMessageTemplate();
        context.buildConstraintViolationWithTemplate(message).addPropertyNode("photoImageId").addConstraintViolation();
        context.buildConstraintViolationWithTemplate(message).addPropertyNode("photoUrl").addConstraintViolation();
        return false;
    }
}
