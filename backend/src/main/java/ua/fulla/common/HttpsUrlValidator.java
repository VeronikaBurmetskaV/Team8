package ua.fulla.common;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.net.URI;
import java.net.URISyntaxException;

public class HttpsUrlValidator implements ConstraintValidator<HttpsUrl, String> {

    @Override
    public boolean isValid(String url, ConstraintValidatorContext context) {
        if (url == null) {
            return true;
        }
        // Lowercase "https://" exactly, like the LIKE 'https://%' CHECK in the database.
        if (!url.startsWith("https://")) {
            return false;
        }
        try {
            String host = new URI(url).getHost();
            return host != null && !host.isEmpty();
        } catch (URISyntaxException e) {
            return false;
        }
    }
}
