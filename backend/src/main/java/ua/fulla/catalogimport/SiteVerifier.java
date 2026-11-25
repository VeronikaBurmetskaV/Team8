package ua.fulla.catalogimport;

import java.io.IOException;
import java.util.Locale;
import java.util.Set;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Element;
import ua.fulla.common.SiteDomain;

/**
 * The three ownership checks of ADR-0017. The email check needs no network; the other two read
 * the home page and {@code /fulla-verification.txt} through the hardened {@link PoliteFetcher}.
 */
final class SiteVerifier {

    static final String META_NAME = "fulla-verification";
    static final String FILE_PATH = "/fulla-verification.txt";
    static final long FILE_MAX_BYTES = 4 * 1024;

    /** How the site was verified; UPPER_CASE in JSON. */
    enum Method {
        META_TAG,
        FILE,
        EMAIL_DOMAIN
    }

    /** {@code method} null = not verified; {@code unreachable} = no page could be read at all. */
    record Outcome(Method method, boolean unreachable) {}

    private SiteVerifier() {}

    /**
     * The email's domain is the site domain or the site is a subdomain of it, and the email
     * domain is not a public mail service.
     */
    static boolean emailDomainMatches(String email, String siteDomain, Set<String> publicDomains) {
        if (email == null || siteDomain == null) {
            return false;
        }
        int at = email.lastIndexOf('@');
        String emailDomain = at < 0 ? null : SiteDomain.ofHost(email.substring(at + 1));
        if (emailDomain == null || publicDomains.contains(emailDomain)
                || publicDomains.contains(email.substring(at + 1).strip().toLowerCase(Locale.ROOT))) {
            return false;
        }
        return SiteDomain.covers(emailDomain, siteDomain);
    }

    /** Meta tag on the home page, then the file. robots.txt must already be loaded. */
    static Outcome checkSite(PoliteFetcher fetcher, String token) {
        boolean anyResponse = false;
        try {
            String html = fetcher.getText(fetcher.baseUrl().toString(), GenericSiteImporter.PAGE_MAX_BYTES);
            anyResponse = true;
            if (html != null && metaMatches(html, token)) {
                return new Outcome(Method.META_TAG, false);
            }
        } catch (IOException | RuntimeException e) {
            // try the file
        }
        try {
            String file = fetcher.getText(fetcher.baseUrl().resolve(FILE_PATH).toString(), FILE_MAX_BYTES);
            anyResponse = true;
            if (file != null && fileMatches(file, token)) {
                return new Outcome(Method.FILE, false);
            }
        } catch (IOException | RuntimeException e) {
            // not verified
        }
        return new Outcome(null, !anyResponse);
    }

    static boolean metaMatches(String html, String token) {
        for (Element meta : Jsoup.parse(html).select("meta[name=" + META_NAME + "]")) {
            if (meta.attr("content").strip().equals(token)) {
                return true;
            }
        }
        return false;
    }

    /** The file holds the token (surrounding spaces, a BOM and a final newline are ignored). */
    static boolean fileMatches(String text, String token) {
        return text.replace("\uFEFF", "").strip().equals(token);
    }
}
