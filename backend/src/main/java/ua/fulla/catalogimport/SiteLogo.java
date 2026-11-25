package ua.fulla.catalogimport;

import java.io.IOException;
import java.net.URI;
import java.util.Locale;
import java.util.Set;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import tools.jackson.core.JacksonException;
import tools.jackson.core.json.JsonReadFeature;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * The logo of a source site, read from its home page (ADR-0014, ADR-0015). Only the URL is kept;
 * the image itself is never fetched or copied. Order: JSON-LD {@code Organization.logo} →
 * {@code <link rel="apple-touch-icon">} → {@code og:image} → favicon ({@code <link rel="icon">},
 * else {@code /favicon.ico}). Only absolute {@code https://} URLs are returned.
 */
final class SiteLogo {

    /** The home page is read with the same cap as a product page. */
    static final long HOME_MAX_BYTES = JsonLdSitemapImporter.PAGE_MAX_BYTES;

    private static final JsonMapper LENIENT_JSON = JsonMapper.builder()
        .enable(JsonReadFeature.ALLOW_UNESCAPED_CONTROL_CHARS)
        .enable(JsonReadFeature.ALLOW_TRAILING_COMMA)
        .build();

    /** Organization and the schema.org subtypes shops use for themselves. */
    private static final Set<String> ORGANIZATION_TYPES = Set.of(
        "Organization", "Corporation", "Brand", "Store", "OnlineStore", "ClothingStore", "LocalBusiness");

    private SiteLogo() {}

    /**
     * One polite request for the home page (robots.txt, pause and request cap of the fetcher).
     * Null when the page is disallowed, missing, or has nothing usable.
     */
    static String fetch(PoliteFetcher fetcher, URI baseUrl) throws IOException {
        String html = fetcher.getText(baseUrl.resolve("/").toString(), HOME_MAX_BYTES);
        return html == null ? null : find(html, baseUrl.resolve("/"));
    }

    /** The logo URL of a home page, resolved against {@code pageUrl}; null when none is https. */
    static String find(String html, URI pageUrl) {
        Document doc = Jsoup.parse(html, pageUrl.toString());
        String[] candidates = {
            jsonLdLogo(doc),
            attr(doc.selectFirst("link[rel~=(?i)^apple-touch-icon(-precomposed)?$][href]"), "href"),
            attr(doc.selectFirst("meta[property=og:image:secure_url][content]"), "content"),
            attr(doc.selectFirst("meta[property=og:image][content]"), "content"),
            attr(doc.selectFirst("link[rel~=(?i)(^|\\s)icon(\\s|$)][href]"), "href"),
            "/favicon.ico",
        };
        for (String candidate : candidates) {
            String url = absoluteHttps(candidate, pageUrl);
            if (url != null) {
                return url;
            }
        }
        return null;
    }

    private static String jsonLdLogo(Document doc) {
        for (Element script : doc.select("script[type=application/ld+json]")) {
            try {
                String logo = logoOf(LENIENT_JSON.readTree(script.data()));
                if (logo != null) {
                    return logo;
                }
            } catch (JacksonException e) {
                // a broken block of another type must not hide the Organization block
            }
        }
        return null;
    }

    /** {@code logo} of the first Organization-like node: a string, an ImageObject or an array. */
    private static String logoOf(JsonNode node) {
        if (node == null) {
            return null;
        }
        if (node.isArray()) {
            for (JsonNode child : node) {
                String logo = logoOf(child);
                if (logo != null) {
                    return logo;
                }
            }
            return null;
        }
        if (!node.isObject()) {
            return null;
        }
        if (isOrganization(node.get("@type"))) {
            String logo = imageUrl(node.get("logo"));
            if (logo != null) {
                return logo;
            }
        }
        String nested = logoOf(node.get("publisher"));
        return nested != null ? nested : logoOf(node.get("@graph"));
    }

    private static boolean isOrganization(JsonNode type) {
        if (type == null) {
            return false;
        }
        if (type.isArray()) {
            for (JsonNode one : type) {
                if (isOrganization(one)) {
                    return true;
                }
            }
            return false;
        }
        return type.isString() && ORGANIZATION_TYPES.contains(type.asString());
    }

    private static String imageUrl(JsonNode image) {
        if (image == null) {
            return null;
        }
        if (image.isArray()) {
            return image.isEmpty() ? null : imageUrl(image.get(0));
        }
        if (image.isObject()) {
            String url = imageUrl(image.get("url"));
            return url != null ? url : imageUrl(image.get("contentUrl"));
        }
        return image.isString() ? image.asString() : null;
    }

    private static String attr(Element element, String name) {
        return element == null ? null : element.attr(name);
    }

    /** Resolved against the page; only {@code https://} with a host; no {@code data:} or others. */
    static String absoluteHttps(String candidate, URI pageUrl) {
        String cleaned = ImportText.clean(candidate);
        if (cleaned == null || cleaned.isEmpty()) {
            return null;
        }
        URI uri = ImportText.parse(cleaned.startsWith("//") ? "https:" + cleaned : cleaned);
        if (uri == null) {
            return null;
        }
        String url = pageUrl.resolve(uri).toString();
        return ImportText.isHttps(url) && url.toLowerCase(Locale.ROOT).startsWith("https://")
            && url.length() <= 2048 ? url : null;
    }
}
