package ua.fulla.common;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

/**
 * The domain of a brand's website (ADR-0017): the URL's host in lower case, without a trailing
 * dot and without a leading {@code www.}. A pure string operation: nothing is requested.
 */
public final class SiteDomain {

    private SiteDomain() {}

    /** {@code https://www.Brand.ua/uk?x=1} → {@code brand.ua}; null when there is no host. */
    public static String of(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        try {
            return ofHost(new URI(url.strip()).getHost());
        } catch (URISyntaxException e) {
            return null;
        }
    }

    /** The host normalized like {@link #of}; null for null or blank. */
    public static String ofHost(String host) {
        if (host == null || host.isBlank()) {
            return null;
        }
        String result = host.strip().toLowerCase(Locale.ROOT);
        if (result.endsWith(".")) {
            result = result.substring(0, result.length() - 1);
        }
        if (result.startsWith("www.") && result.indexOf('.', 4) > 0) {
            result = result.substring(4);
        }
        return result.isEmpty() ? null : result;
    }

    /** True when {@code host} is {@code domain} itself or one of its subdomains (any {@code www.}). */
    public static boolean covers(String domain, String host) {
        String d = ofHost(domain);
        String h = host == null ? null : host.strip().toLowerCase(Locale.ROOT);
        if (d == null || h == null) {
            return false;
        }
        if (h.endsWith(".")) {
            h = h.substring(0, h.length() - 1);
        }
        return h.equals(d) || h.endsWith("." + d);
    }
}
