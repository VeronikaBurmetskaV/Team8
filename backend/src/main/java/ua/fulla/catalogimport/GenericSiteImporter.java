package ua.fulla.catalogimport;

import java.io.IOException;
import java.io.StringReader;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamException;
import javax.xml.stream.XMLStreamReader;
import org.jsoup.Jsoup;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import ua.fulla.common.SiteDomain;

/**
 * The one generic importer of a brand's own site (ADR-0017); no site-specific parsers. The
 * first source that yields products wins:
 * <ol>
 *   <li>the brand's feed ({@code feedUrl}, Google/Facebook XML, {@link MerchantFeed});</li>
 *   <li>Shopify {@code /products.json} ({@link ShopifyProducts});</li>
 *   <li>{@code /sitemap.xml} (and a sitemap index) → product pages → JSON-LD ({@link JsonLdProducts}).</li>
 * </ol>
 * Every item's {@code externalId} is the path (+ a non-tracking query) of its product URL, so the
 * same product gets the same ID whichever source found it.
 */
class GenericSiteImporter implements CatalogImporter {

    private static final Logger log = LoggerFactory.getLogger(GenericSiteImporter.class);

    static final String CODE = "brand-site";
    static final long FEED_MAX_BYTES = 30L * 1024 * 1024;
    static final long JSON_MAX_BYTES = 10L * 1024 * 1024;
    static final long SITEMAP_MAX_BYTES = 30L * 1024 * 1024;
    static final long PAGE_MAX_BYTES = 3L * 1024 * 1024;
    /** At most this many child sitemaps of a sitemap index are read. */
    static final int MAX_SITEMAPS = 5;
    /** One page of {@code products.json}; a full page means the listing may go on. */
    static final int SHOPIFY_PAGE = 250;

    private final URI baseUrl;
    private final String feedUrl;
    private final String brandName;

    /** @param feedUrl the brand's feed on its own domain, or null */
    GenericSiteImporter(URI baseUrl, String feedUrl, String brandName) {
        this.baseUrl = baseUrl;
        this.feedUrl = feedUrl;
        this.brandName = brandName;
    }

    @Override
    public String code() {
        return CODE;
    }

    @Override
    public URI baseUrl() {
        return baseUrl;
    }

    /**
     * Tries the sources in order. An empty batch ({@code method == null}) means no source had
     * products. Network errors of one source let the next one try; when no source worked and one
     * of them failed on the network, that error is thrown (the site is unreachable).
     */
    @Override
    public ImportBatch fetch(PoliteFetcher fetcher, int maxProducts) throws IOException {
        IOException lastError = null;
        if (feedUrl != null) {
            try {
                ImportBatch feed = fromFeed(fetcher, maxProducts);
                if (feed != null) {
                    return feed;
                }
            } catch (UnsafeUrlException e) {
                throw e;
            } catch (IOException e) {
                log.info("Brand feed {} not read: {}", feedUrl, e.getMessage());
                lastError = e;
            }
        }
        try {
            ImportBatch shopify = fromShopify(fetcher, maxProducts);
            if (shopify != null) {
                return shopify;
            }
        } catch (UnsafeUrlException e) {
            throw e;
        } catch (IOException e) {
            lastError = e;
        }
        try {
            ImportBatch sitemap = fromSitemap(fetcher, maxProducts);
            if (sitemap != null) {
                return sitemap;
            }
        } catch (UnsafeUrlException e) {
            throw e;
        } catch (IOException e) {
            lastError = e;
        }
        if (lastError != null) {
            throw lastError;
        }
        return new ImportBatch(List.of(), false, Set.of(), null, null, 0);
    }

    // ---------- 1. the brand's feed ----------

    private ImportBatch fromFeed(PoliteFetcher fetcher, int maxProducts) throws IOException {
        MerchantFeed.Parsed parsed = fetcher.getStream(feedUrl, FEED_MAX_BYTES,
            body -> MerchantFeed.parse(body, maxProducts, maxProducts, true, (brand, type) -> brandName));
        if (parsed == null || parsed.links().isEmpty()) {
            return null;
        }
        Set<String> listed = parsed.links().stream().map(GenericSiteImporter::externalIdFor)
            .collect(Collectors.toCollection(LinkedHashSet::new));
        return new ImportBatch(rekey(parsed.items()), true, listed, "feed", feedUrl, parsed.skipped());
    }

    // ---------- 2. Shopify ----------

    private ImportBatch fromShopify(PoliteFetcher fetcher, int maxProducts) throws IOException {
        String url = baseUrl.resolve("/products.json?limit=" + SHOPIFY_PAGE).toString();
        String json = fetcher.getText(url, JSON_MAX_BYTES);
        if (json == null) {
            return null;
        }
        ShopifyProducts.Parsed parsed = ShopifyProducts.parse(json, baseUrl, brandName, maxProducts);
        if (parsed == null || parsed.links().isEmpty()) {
            return null;
        }
        Set<String> listed = parsed.links().stream().map(GenericSiteImporter::externalIdFor)
            .collect(Collectors.toCollection(LinkedHashSet::new));
        // A full page: there may be a second one, so the listing is not complete.
        boolean complete = parsed.total() < SHOPIFY_PAGE;
        return new ImportBatch(rekey(parsed.items()), complete, listed, "shopify", url, parsed.skipped());
    }

    // ---------- 3. sitemap + JSON-LD ----------

    private ImportBatch fromSitemap(PoliteFetcher fetcher, int maxProducts) throws IOException {
        String xml = fetcher.getText(baseUrl.resolve("/sitemap.xml").toString(), SITEMAP_MAX_BYTES);
        if (xml == null) {
            return null;
        }
        Sitemap root = Sitemap.parse(xml);
        List<String> urls = new ArrayList<>(root.urls());
        boolean listingComplete = true;
        if (!root.sitemaps().isEmpty()) {
            List<String> children = root.sitemaps().stream().filter(this::isOwnHttps).toList();
            List<String> productMaps = children.stream()
                .filter(u -> u.toLowerCase(Locale.ROOT).contains("product")).toList();
            List<String> toRead = productMaps.isEmpty() ? children : productMaps;
            if (toRead.size() > MAX_SITEMAPS) {
                listingComplete = false;
                toRead = toRead.subList(0, MAX_SITEMAPS);
            }
            for (String child : toRead) {
                try {
                    String childXml = fetcher.getText(child, SITEMAP_MAX_BYTES);
                    if (childXml == null) {
                        listingComplete = false;
                        continue;
                    }
                    urls.addAll(Sitemap.parse(childXml).urls());
                } catch (UnsafeUrlException | SourceStoppedException e) {
                    throw e;
                } catch (IOException e) {
                    log.info("Sitemap {} not read: {}", child, e.getMessage());
                    listingComplete = false;
                }
            }
        }
        List<String> candidates = productPages(urls);
        if (candidates.isEmpty()) {
            return null;
        }

        List<ImportedItem> items = new ArrayList<>();
        int skipped = 0;
        for (String url : candidates) {
            if (items.size() >= maxProducts || !fetcher.hasRequestBudget()) {
                break;
            }
            try {
                String html = fetcher.getText(url, PAGE_MAX_BYTES);
                if (html == null) {
                    continue;
                }
                var item = JsonLdProducts.parse(html, url, brandName, externalIdFor(url));
                if (item.isPresent()) {
                    items.add(item.get());
                } else if (JsonLdProducts.findProduct(Jsoup.parse(html, url)) != null) {
                    skipped++; // a product, but not clothing / not UAH / incomplete
                }
            } catch (SourceStoppedException e) {
                log.info("Site stopped the import: {}", e.getMessage());
                break;
            } catch (IOException e) {
                // One broken page doesn't stop the import; it is still listed, so it isn't hidden.
                log.info("Page {} skipped: {}", url, e.getMessage());
            }
        }
        Set<String> listed = candidates.stream().map(GenericSiteImporter::externalIdFor)
            .collect(Collectors.toCollection(LinkedHashSet::new));
        if (items.isEmpty() && skipped == 0) {
            return null;
        }
        return new ImportBatch(items, listingComplete, listed, "sitemap", null, skipped);
    }

    /**
     * Pages of the own domain without a query. If some URLs look like product pages
     * ({@code /product…}, {@code /p/…}), only those; else the URLs with an image; else all.
     */
    private List<String> productPages(List<String> urls) {
        List<String> own = urls.stream().distinct().filter(this::isOwnHttps)
            .filter(u -> ImportText.parse(u).getRawQuery() == null).toList();
        List<String> products = own.stream().filter(u -> {
            String path = ImportText.parse(u).getRawPath().toLowerCase(Locale.ROOT);
            return path.contains("/product") || path.contains("/p/");
        }).toList();
        return products.isEmpty() ? own : products;
    }

    private boolean isOwnHttps(String url) {
        URI uri = ImportText.parse(url);
        return uri != null && "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null
            && SiteDomain.covers(SiteDomain.ofHost(baseUrl.getHost()), uri.getHost());
    }

    // ---------- IDs ----------

    private static List<ImportedItem> rekey(List<ImportedItem> items) {
        return items.stream().map(item -> new ImportedItem(externalIdFor(item.productUrl()), item.brandName(),
            item.name(), item.priceUah(), item.photoUrl(), item.productUrl(), item.available(), item.sizes(),
            item.colors(), item.material(), item.description())).toList();
    }

    /**
     * The product's ID within the brand: the URL path without a trailing slash, plus the query
     * without tracking and variant parameters ({@code utm_*}, {@code variant}, …). Longer than
     * 100 characters → {@code sha256:} + the hash of that text.
     */
    static String externalIdFor(String url) {
        URI uri = ImportText.parse(url);
        String path = uri == null || uri.getRawPath() == null || uri.getRawPath().isEmpty() ? "/" : uri.getRawPath();
        if (path.length() > 1 && path.endsWith("/")) {
            path = path.substring(0, path.length() - 1);
        }
        String query = uri == null || uri.getRawQuery() == null ? "" : Arrays.stream(uri.getRawQuery().split("&"))
            .filter(pair -> !pair.isEmpty() && !isIgnoredParam(pair))
            .collect(Collectors.joining("&"));
        String id = query.isEmpty() ? path : path + "?" + query;
        if (id.length() <= ImportText.EXTERNAL_ID_MAX) {
            return id;
        }
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(id.getBytes(StandardCharsets.UTF_8));
            return "sha256:" + HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static boolean isIgnoredParam(String pair) {
        int equals = pair.indexOf('=');
        String key = (equals < 0 ? pair : pair.substring(0, equals)).toLowerCase(Locale.ROOT);
        return key.startsWith("utm_") || key.equals("variant") || key.equals("fbclid") || key.equals("gclid")
            || key.equals("srsltid");
    }

    /** {@code <sitemapindex>} children and {@code <urlset>} page URLs of one sitemap file. */
    record Sitemap(List<String> sitemaps, List<String> urls) {

        static Sitemap parse(String xml) throws IOException {
            XMLInputFactory factory = XMLInputFactory.newFactory();
            factory.setProperty(XMLInputFactory.SUPPORT_DTD, false);
            factory.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false);
            factory.setProperty(XMLInputFactory.IS_COALESCING, true);
            List<String> sitemaps = new ArrayList<>();
            List<String> urls = new ArrayList<>();
            try {
                XMLStreamReader reader = factory.createXMLStreamReader(new StringReader(xml));
                try {
                    String parent = null;
                    while (reader.hasNext()) {
                        int event = reader.next();
                        if (event == XMLStreamConstants.START_ELEMENT) {
                            String name = reader.getLocalName();
                            if (name.equals("sitemap") || name.equals("url")) {
                                parent = name;
                            } else if (name.equals("loc") && parent != null) {
                                String loc = ImportText.clean(reader.getElementText());
                                if (loc != null) {
                                    (parent.equals("sitemap") ? sitemaps : urls).add(loc);
                                }
                                parent = null; // only the first <loc>; image:loc etc. are not pages
                            }
                        }
                    }
                } finally {
                    reader.close();
                }
            } catch (XMLStreamException e) {
                throw new IOException("sitemap is not valid XML: " + e.getMessage(), e);
            }
            return new Sitemap(sitemaps, urls);
        }
    }
}
