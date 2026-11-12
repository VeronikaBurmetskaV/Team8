package ua.fulla.common;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.net.URI;
import java.net.URISyntaxException;

public class HttpUrlValidator implements ConstraintValidator<HttpUrl, String> {

    @Override
    public boolean isValid(String url, ConstraintValidatorContext context) {
        if (url == null) {
            return true;
        }
        try {
            URI uri = new URI(url);
            // Schemes are case-insensitive, like the ~* '^https?://' CHECK in the database.
            boolean http = "http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme());
            // A host exists only in the "scheme://host" form, so "http:/x" and "http://" fail here.
            return http && uri.getHost() != null && !uri.getHost().isEmpty();
        } catch (URISyntaxException e) {
            // Spaces, control characters and other characters a URI cannot contain.
            return false;
        }
    }
}
