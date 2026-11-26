package ua.fulla.catalogimport;

import static ua.fulla.catalogimport.JsonLdProducts.additionalProperties;
import static ua.fulla.catalogimport.JsonLdProducts.findProduct;
import static ua.fulla.catalogimport.JsonLdProducts.first;
import static ua.fulla.catalogimport.JsonLdProducts.imageUrl;
import static ua.fulla.catalogimport.JsonLdProducts.isAvailable;
import static ua.fulla.catalogimport.JsonLdProducts.text;

import java.io.IOException;
import java.io.StringReader;
import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamException;
import javax.xml.stream.XMLStreamReader;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.databind.JsonNode;
import ua.fulla.products.ProductColor;
import ua.fulla.products.ProductSize;

/**
 * Demo shops without a feed (ADR-0014): {@code sitemap.xml} → product pages → JSON-LD
 * {@code Product} (name, image, price, availability, description; read by the shared
 * {@link JsonLdProducts}) plus sizes, colour and material from the shop's HTML (Jsoup).
 * The newest pages of the sitemap ({@code lastmod}) are read first. {@code external_id} is the
 * product URL path.
 */
class JsonLdSitemapImporter implements CatalogImporter {

    private static final Logger log = LoggerFactory.getLogger(JsonLdSitemapImporter.class);

    static final String SITEMAP_PATH = "/sitemap.xml";
    static final long SITEMAP_MAX_BYTES = 30L * 1024 * 1024;
    static final long PAGE_MAX_BYTES = 3L * 1024 * 1024;

    /** The markup differences of the two shops. */
    enum Site {
        /** OpenCart: product URLs are top-level slugs with an image in the sitemap; uk is the default language. */
        ONE_BY_ONE,
        /** Laravel: product URLs start with {@code /product/}; the sitemap also lists thousands of category pages. */
        CHER17
    }

    private final String code;
    private final URI baseUrl;
    private final String brandName;
    private final Site site;

    JsonLdSitemapImporter(String code, URI baseUrl, String brandName, Site site) {
        this.code = code;
        this.baseUrl = baseUrl;
        this.brandName = brandName;
        this.site = site;
    }

    @Override
    public String code() {
        return code;
    }

    @Override
    public URI baseUrl() {
        return baseUrl;
    }

    @Override
    public ImportBatch fetch(PoliteFetcher fetcher, int maxProducts) throws IOException {
        String sitemap = fetcher.getText(baseUrl.resolve(SITEMAP_PATH).toString(), SITEMAP_MAX_BYTES);
        if (sitemap == null) {
            throw new IOException("sitemap.xml is missing or disallowed by robots.txt");
        }
        // The whole source is one brand, so the per-brand cap is the source's cap too.
        int limit = Math.min(maxProducts, ImportProperties.MAX_PRODUCTS_PER_BRAND);
        List<ImportedItem> items = new ArrayList<>();
        boolean complete = true;
        for (String url : productUrls(sitemap)) {
            if (items.size() >= limit || !fetcher.hasRequestBudget()) {
                break;
            }
            try {
                String html = fetcher.getText(url, PAGE_MAX_BYTES);
                if (html != null) {
                    parseProduct(html, url).ifPresent(items::add);
                }
            } catch (SourceStoppedException e) {
                log.warn("{}: source stopped the run: {}", code, e.getMessage());
                complete = false;
                break;
            } catch (IOException | RuntimeException e) {
                // One broken page doesn't stop the source, but the run is no longer complete (T-16).
                log.warn("{}: page {} skipped: {}", code, url, e.getMessage());
                complete = false;
            }
        }
        return new ImportBatch(items, complete);
    }

    /**
     * Product page URLs of the sitemap, newest {@code lastmod} first, without duplicates; only
     * {@code https} URLs of the source host and only the shop's product pages.
     */
    List<String> productUrls(String sitemapXml) throws IOException {
        record Entry(String url, String lastmod, int order) {}
        XMLInputFactory factory = XMLInputFactory.newFactory();
        factory.setProperty(XMLInputFactory.SUPPORT_DTD, false);
        factory.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false);
        factory.setProperty(XMLInputFactory.IS_COALESCING, true);

        Map<String, Entry> entries = new LinkedHashMap<>();
        try {
            XMLStreamReader reader = factory.createXMLStreamReader(new StringReader(sitemapXml));
            try {
                String loc = null;
                String lastmod = null;
                boolean hasImage = false;
                boolean inUrl = false;
                while (reader.hasNext()) {
                    int event = reader.next();
                    if (event == XMLStreamConstants.START_ELEMENT) {
                        String name = reader.getLocalName();
                        if (name.equals("url")) {
                            inUrl = true;
                            loc = null;
                            lastmod = null;
                            hasImage = false;
                        } else if (inUrl && name.equals("loc") && loc == null) {
                            loc = ImportText.clean(reader.getElementText());
                        } else if (inUrl && name.equals("lastmod")) {
                            lastmod = ImportText.clean(reader.getElementText());
                        } else if (inUrl && name.equals("image")) {
                            hasImage = true;
                        }
                    } else if (event == XMLStreamConstants.END_ELEMENT && reader.getLocalName().equals("url")) {
                        inUrl = false;
                        if (loc != null && isProductUrl(loc, hasImage) && !entries.containsKey(loc)) {
                            entries.put(loc, new Entry(loc, lastmod == null ? "" : lastmod, entries.size()));
                        }
                    }
                }
            } finally {
                reader.close();
            }
        } catch (XMLStreamException e) {
            throw new IOException("sitemap.xml is not valid XML: " + e.getMessage(), e);
        }
        return entries.values().stream()
            .sorted(Comparator.comparing(Entry::lastmod).reversed().thenComparing(Entry::order))
            .map(Entry::url)
            .toList();
    }

    private boolean isProductUrl(String url, boolean hasImage) {
        URI uri = ImportText.parse(url);
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null
                || !uri.getHost().equalsIgnoreCase(baseUrl.getHost()) || uri.getRawQuery() != null) {
            return false;
        }
        String path = uri.getRawPath() == null ? "" : uri.getRawPath();
        return switch (site) {
            // Ukrainian pages only (the /ru/ and /en/ copies are the same products); categories have no image.
            case ONE_BY_ONE -> hasImage && path.length() > 1 && path.indexOf('/', 1) < 0;
            case CHER17 -> path.startsWith("/product/") && path.length() > "/product/".length();
        };
    }

    /**
     * Empty when the page has no usable JSON-LD {@code Product} (no name, price or https photo)
     * or the product is not clothing ({@link ClothingFilter} on the name and the JSON-LD
     * {@code category} text, if there is one).
     */
    Optional<ImportedItem> parseProduct(String html, String pageUrl) {
        Document doc = Jsoup.parse(html, pageUrl);
        JsonNode product = findProduct(doc);
        if (product == null) {
            return Optional.empty();
        }
        String name = ImportText.cardName(text(product.get("name")));
        // The shop's free-form category («Сукні», «Аксесуари») is a type, not a Google path.
        if (!ClothingFilter.isClothing(name, ImportText.clean(text(product.get("category"))), null)) {
            log.debug("{}: {} skipped: not clothing ({})", code, pageUrl, name);
            return Optional.empty();
        }
        JsonNode offer = first(product.get("offers"));
        Integer price = offer == null ? null
            : ImportText.priceUah(firstNonBlank(text(offer.get("price")), text(offer.get("lowPrice"))));
        String photoUrl = imageUrl(product.get("image"));
        String externalId = externalId(doc, pageUrl);
        if (name == null || price == null || !ImportText.isHttps(photoUrl) || externalId == null) {
            return Optional.empty();
        }

        List<ProductSize> sizes = switch (site) {
            case ONE_BY_ONE -> oneByOneSizes(doc);
            case CHER17 -> cher17Sizes(doc);
        };
        Map<String, String> properties = additionalProperties(product.get("additionalProperty"));
        String colorName = firstNonBlank(htmlColor(doc), properties.get("колір"));
        String material = firstNonBlank(htmlMaterial(doc), properties.get("матеріал"));

        boolean offerAvailable = offer == null || isAvailable(text(offer.get("availability")));
        boolean available = offerAvailable && (sizes.isEmpty() || sizes.stream().anyMatch(ProductSize::available));

        List<ProductColor> colors = ImportText.colors(colorName);
        return Optional.of(new ImportedItem(
            externalId,
            brandName,
            name,
            price,
            photoUrl,
            pageUrl,
            available,
            sizes,
            colors,
            ImportText.limit(material, ImportText.MATERIAL_MAX),
            ImportText.plainText(text(product.get("description")), ImportText.DESCRIPTION_MAX)));
    }

    // ---------- HTML ----------

    /**
     * One By One: {@code <label class="product-size__item [sold|last]"><input …><big>M <small>(…)</small></big>}.
     * The {@code <small>} note is «(sold out)», «(pre-order)», «(last size)» or, on the live site,
     * an exact count such as «(2 од.)». Only that explicit count becomes a quantity
     * ({@link #oneByOneQuantity}); «last size» is ambiguous (the last item of the size, or the
     * last size left) and stays unknown, like a size without a note.
     */
    private static List<ProductSize> oneByOneSizes(Document doc) {
        Map<String, List<ProductSize>> sizes = new LinkedHashMap<>();
        for (Element item : doc.select(".product-size-box .product-size__item")) {
            Element big = item.selectFirst("big");
            if (big == null) {
                continue;
            }
            Element copy = big.clone();
            Element small = copy.selectFirst("small");
            Integer quantity = small == null ? null : oneByOneQuantity(small.text());
            copy.select("small").remove();
            String label = ImportText.clean(copy.text());
            Element input = item.selectFirst("input");
            boolean available = !item.hasClass("sold") && (input == null || !input.hasAttr("disabled"));
            if (label != null) {
                sizes.computeIfAbsent(label, key -> new ArrayList<>()).add(new ProductSize(label, available, quantity));
            }
        }
        List<ProductSize> result = new ArrayList<>();
        sizes.values().forEach(same -> result.add(mergeSameLabel(same)));
        return result;
    }

    /** «(2 од.)» — the one form of an explicit count on One By One. Anything else: null (unknown). */
    private static final Pattern ONE_BY_ONE_COUNT =
        Pattern.compile("\\(\\s*(\\d{1,5})\\s*од\\.?\\s*\\)", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    /** The exact number of items in a One By One size note, or null when the note states none. */
    static Integer oneByOneQuantity(String note) {
        String text = ImportText.clean(note);
        if (text == null) {
            return null;
        }
        Matcher matcher = ONE_BY_ONE_COUNT.matcher(text);
        return matcher.matches() ? Integer.valueOf(matcher.group(1)) : null;
    }

    /**
     * One size written more than once on a page: available when any copy is. A count is kept only
     * when the label appears once; two copies (e.g. two colours) are never added up or guessed.
     */
    static ProductSize mergeSameLabel(List<ProductSize> same) {
        ProductSize first = same.getFirst();
        if (same.size() == 1) {
            return first;
        }
        boolean available = same.stream().anyMatch(ProductSize::available);
        return new ProductSize(first.label(), available, null);
    }

    /** Cher'17: {@code <label class="checkbox-list__item" data-type="normal"><input name="sizes" …><span class="checkbox-list__text">M/L</span>}. */
    private static List<ProductSize> cher17Sizes(Document doc) {
        Map<String, Boolean> sizes = new LinkedHashMap<>();
        for (Element input : doc.select("label.checkbox-list__item > input[name=sizes]")) {
            Element label = input.parent();
            Element text = label == null ? null : label.selectFirst(".checkbox-list__text");
            String name = text == null ? null : ImportText.clean(text.text());
            if (name == null) {
                continue;
            }
            String type = label.attr("data-type").toLowerCase(Locale.ROOT);
            boolean available = !input.hasAttr("disabled") && !label.hasClass("disabled")
                && (type.isEmpty() || type.equals("normal") || type.equals("preorder"));
            sizes.merge(name, available, Boolean::logicalOr);
        }
        return toSizes(sizes);
    }

    private String htmlColor(Document doc) {
        return switch (site) {
            case ONE_BY_ONE -> {
                for (Element param : doc.select(".cart-param")) {
                    Element name = param.selectFirst(".cart-param__name");
                    Element value = param.selectFirst(".cart-param__descr");
                    if (name != null && value != null && name.text().strip().startsWith("Колір")) {
                        yield ImportText.clean(value.text());
                    }
                }
                yield null;
            }
            case CHER17 -> {
                for (Element span : doc.select(".product-main-detail__name")) {
                    String text = ImportText.clean(span.text());
                    if (text != null && text.startsWith("Колір:")) {
                        yield ImportText.clean(text.substring("Колір:".length()));
                    }
                }
                yield null;
            }
        };
    }

    /** «Матеріал верху: Вовна 70%, Акріл 30%; Підкладка: віскоза-100%». */
    private String htmlMaterial(Document doc) {
        Set<String> parts = new LinkedHashSet<>();
        switch (site) {
            case ONE_BY_ONE -> {
                for (Element row : doc.select(".product__table-row")) {
                    Element label = row.selectFirst("dt");
                    Element value = row.selectFirst("dd");
                    String key = label == null ? null : ImportText.clean(label.text());
                    String text = value == null ? null : ImportText.clean(value.text());
                    if (key != null && text != null && isMaterialLabel(key)) {
                        parts.add(stripColon(key) + ": " + text);
                    }
                }
            }
            case CHER17 -> {
                for (Element span : doc.select(".product-main-detail__name")) {
                    String text = ImportText.clean(span.text());
                    if (text != null && text.contains(":") && isMaterialLabel(text)) {
                        parts.add(text);
                    }
                }
            }
        }
        return parts.isEmpty() ? null : String.join("; ", parts);
    }

    private static boolean isMaterialLabel(String text) {
        return text.startsWith("Матеріал") || text.startsWith("Склад") || text.startsWith("Підкладка")
            || text.startsWith("Утеплювач");
    }

    private static String stripColon(String text) {
        return text.endsWith(":") ? text.substring(0, text.length() - 1).strip() : text;
    }

    // ---------- helpers ----------

    /** The URL path of the canonical link (same host) or of the page; null if longer than 100. */
    private String externalId(Document doc, String pageUrl) {
        Element canonical = doc.selectFirst("link[rel=canonical]");
        URI uri = canonical == null ? null : ImportText.parse(canonical.absUrl("href"));
        if (uri == null || uri.getHost() == null || !uri.getHost().equalsIgnoreCase(baseUrl.getHost())) {
            uri = ImportText.parse(pageUrl);
        }
        String path = uri == null ? null : uri.getRawPath();
        if (path == null || path.isEmpty() || path.length() > ImportText.EXTERNAL_ID_MAX) {
            return null;
        }
        return path;
    }

    private static List<ProductSize> toSizes(Map<String, Boolean> sizes) {
        List<ProductSize> result = new ArrayList<>();
        sizes.forEach((label, available) -> result.add(new ProductSize(label, available)));
        return result;
    }

    private static String firstNonBlank(String a, String b) {
        String first = ImportText.clean(a);
        return first != null ? first : ImportText.clean(b);
    }
}
