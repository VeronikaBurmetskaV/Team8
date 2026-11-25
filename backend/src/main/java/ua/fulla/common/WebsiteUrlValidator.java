package ua.fulla.common;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Arrays;
import java.util.Locale;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * {@link WebsiteUrl}: lowercase {@code https://} (like the {@code LIKE 'https://%'} CHECK in the
 * database), parsed by {@link URI}, a host that is a domain name — at least two non-empty labels,
 * the last one starting with a letter (so not {@code localhost} or an IP address) — and at most
 * {@value #MAX_LENGTH} characters. The value is checked after {@link #normalize} (spaces and
 * tracking parameters removed), exactly as it is saved. The
 * examples are shared with the frontend (validation.examples.json, «websiteUrl»).
 */
public class WebsiteUrlValidator implements ConstraintValidator<WebsiteUrl, String> {

    public static final int MAX_LENGTH = 2048;
    private static final Pattern LABEL = Pattern.compile("[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?");

    private boolean required;

    @Override
    public void initialize(WebsiteUrl annotation) {
        this.required = annotation.required();
    }

    @Override
    public boolean isValid(String url, ConstraintValidatorContext context) {
        return url == null ? !required : isWebsite(url);
    }

    /**
     * The value as it is validated and stored — the same as normalizeWebsiteUrl on the frontend
     * (examples: validation.examples.json, «websiteUrlNormalized»): spaces trimmed and the
     * tracking parameters ({@code srsltid}, {@code fbclid}, {@code gclid}, {@code utm_*}) removed;
     * the path, other parameters and a {@code #fragment} stay; a {@code ?} left with nothing after
     * it goes too. A pure string operation: nothing is requested (A-15).
     */
    public static String normalize(String url) {
        if (url == null) {
            return null;
        }
        String trimmed = UnicodeText.trim(url);
        int hash = trimmed.indexOf('#');
        String base = hash < 0 ? trimmed : trimmed.substring(0, hash);
        String fragment = hash < 0 ? "" : trimmed.substring(hash);
        int question = base.indexOf('?');
        if (question < 0) {
            return trimmed;
        }
        String kept = Arrays.stream(base.substring(question + 1).split("&", -1))
            .filter(pair -> !pair.isEmpty() && !isTrackingParam(pair))
            .collect(Collectors.joining("&"));
        return base.substring(0, question) + (kept.isEmpty() ? "" : "?" + kept) + fragment;
    }

    private static boolean isTrackingParam(String pair) {
        int equals = pair.indexOf('=');
        String key = (equals < 0 ? pair : pair.substring(0, equals)).toLowerCase(Locale.ROOT);
        return key.equals("srsltid") || key.equals("fbclid") || key.equals("gclid") || key.startsWith("utm_");
    }

    static boolean isWebsite(String raw) {
        String url = normalize(raw);
        if (url.isEmpty() || url.length() > MAX_LENGTH || !url.startsWith("https://")) {
            return false;
        }
        String host;
        try {
            host = new URI(url).getHost();
        } catch (URISyntaxException e) {
            return false;
        }
        return host != null && isDomain(host);
    }

    private static boolean isDomain(String host) {
        String name = host.endsWith(".") ? host.substring(0, host.length() - 1) : host;
        String[] labels = name.split("\\.", -1);
        if (labels.length < 2) {
            return false;
        }
        for (String label : labels) {
            if (!LABEL.matcher(label).matches()) {
                return false;
            }
        }
        return Character.isLetter(labels[labels.length - 1].charAt(0));
    }
}
