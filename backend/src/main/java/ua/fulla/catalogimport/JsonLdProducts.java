package ua.fulla.catalogimport;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import tools.jackson.core.JacksonException;
import tools.jackson.core.json.JsonReadFeature;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import ua.fulla.products.ProductColor;
import ua.fulla.products.ProductSize;

/**
 * Schema.org {@code Product} / {@code ProductGroup} in a page's JSON-LD. The helpers are shared
 * by the demo importer (ADR-0014, which adds site-specific HTML sizes) and the generic brand
 * site importer (ADR-0017, {@link #parse}, JSON-LD only).
 */
final class JsonLdProducts {

    /** Some pages put raw line breaks inside JSON strings (Cher'17 descriptions); browsers accept that. */
    static final JsonMapper LENIENT_JSON = JsonMapper.builder()
        .enable(JsonReadFeature.ALLOW_UNESCAPED_CONTROL_CHARS)
        .enable(JsonReadFeature.ALLOW_TRAILING_COMMA)
        .build();

    private static final Set<String> NOT_AVAILABLE = Set.of("outofstock", "soldout", "discontinued");
    private static final Set<String> PRODUCT_TYPES = Set.of("Product", "ProductGroup");

    private JsonLdProducts() {}

    /**
     * The generic reading of one product page (ADR-0017): name, photo, price (UAH only), sizes of
     * a {@code ProductGroup}'s {@code hasVariant}, availability, colour, material, description.
     * Empty when the page has no usable product (no JSON-LD product, no name, price or https
     * photo, another currency) or it is not clothing.
     */
    static Optional<ImportedItem> parse(String html, String pageUrl, String brandName, String externalId) {
        Document doc = Jsoup.parse(html, pageUrl);
        JsonNode product = findProduct(doc);
        if (product == null || externalId == null) {
            return Optional.empty();
        }
        String name = ImportText.cardName(text(product.get("name")));
        if (!ClothingFilter.isClothing(name, ImportText.clean(text(product.get("category"))), null)) {
            return Optional.empty();
        }
        List<JsonNode> variants = list(product.get("hasVariant"));
        List<JsonNode> offers = new ArrayList<>(list(product.get("offers")));
        for (JsonNode variant : variants) {
            offers.addAll(list(variant.get("offers")));
        }
        JsonNode offer = offers.isEmpty() ? null : offers.get(0);
        String currency = offer == null ? null : ImportText.clean(text(offer.get("priceCurrency")));
        if (currency != null && !currency.equalsIgnoreCase("UAH")) {
            return Optional.empty();
        }
        Integer price = offer == null ? null
            : ImportText.priceUah(firstNonBlank(text(offer.get("price")), text(offer.get("lowPrice"))));
        String photoUrl = imageUrl(product.get("image"));
        if (photoUrl == null && !variants.isEmpty()) {
            photoUrl = imageUrl(variants.get(0).get("image"));
        }
        if (name == null || price == null || !ImportText.isHttps(photoUrl)) {
            return Optional.empty();
        }

        Map<String, Boolean> sizeMap = new LinkedHashMap<>();
        for (JsonNode variant : variants) {
            JsonNode sizeNode = variant.get("size");
            String size = ImportText.clean(sizeNode != null && sizeNode.isObject() ? text(sizeNode.get("name")) : text(sizeNode));
            if (size != null) {
                JsonNode variantOffer = first(variant.get("offers"));
                boolean available = variantOffer == null || isAvailable(text(variantOffer.get("availability")));
                sizeMap.merge(size, available, Boolean::logicalOr);
            }
        }
        List<ProductSize> sizes = new ArrayList<>();
        sizeMap.forEach((label, available) -> sizes.add(new ProductSize(label, available)));

        boolean available = offers.isEmpty()
            || offers.stream().anyMatch(o -> isAvailable(text(o.get("availability"))));
        Map<String, String> properties = additionalProperties(product.get("additionalProperty"));
        String color = firstNonBlank(text(product.get("color")), properties.get("колір"));
        String material = firstNonBlank(text(product.get("material")), properties.get("матеріал"));
        List<ProductColor> colors = ImportText.colors(color);
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

    // ---------- shared helpers ----------

    static JsonNode findProduct(Document doc) {
        for (Element script : doc.select("script[type=application/ld+json]")) {
            JsonNode root;
            try {
                root = LENIENT_JSON.readTree(script.data());
            } catch (JacksonException e) {
                continue; // a broken block of another type must not hide the Product block
            }
            JsonNode product = findProduct(root);
            if (product != null) {
                return product;
            }
        }
        return null;
    }

    private static JsonNode findProduct(JsonNode node) {
        if (node == null) {
            return null;
        }
        if (node.isArray()) {
            for (JsonNode child : node) {
                JsonNode found = findProduct(child);
                if (found != null) {
                    return found;
                }
            }
            return null;
        }
        if (!node.isObject()) {
            return null;
        }
        JsonNode type = node.get("@type");
        if (type != null && (isProductType(type) || (type.isArray() && hasProductType(type)))) {
            return node;
        }
        return findProduct(node.get("@graph"));
    }

    private static boolean hasProductType(JsonNode types) {
        for (JsonNode type : types) {
            if (isProductType(type)) {
                return true;
            }
        }
        return false;
    }

    private static boolean isProductType(JsonNode type) {
        return type.isString() && PRODUCT_TYPES.contains(type.asString());
    }

    /** A string, an array of strings or an {@code ImageObject}: the first URL. */
    static String imageUrl(JsonNode image) {
        JsonNode first = first(image);
        if (first == null) {
            return null;
        }
        String url = first.isObject() ? text(first.get("url")) : text(first);
        return ImportText.clean(url);
    }

    static boolean isAvailable(String availability) {
        if (availability == null) {
            return true;
        }
        String value = availability.substring(availability.lastIndexOf('/') + 1).toLowerCase(Locale.ROOT);
        return !NOT_AVAILABLE.contains(value);
    }

    /**
     * {@code additionalProperty} as label → value. Cher'17 swaps the fields
     * ({@code "name": "поліестер-100%", "value": "Матріал"}), so both orders are accepted.
     */
    static Map<String, String> additionalProperties(JsonNode properties) {
        Map<String, String> result = new LinkedHashMap<>();
        if (properties == null || !properties.isArray()) {
            return result;
        }
        for (JsonNode property : properties) {
            String name = ImportText.clean(text(property.get("name")));
            String value = ImportText.clean(text(property.get("value")));
            String label = propertyLabel(value);
            if (label != null && name != null) {
                result.putIfAbsent(label, name);
            } else if (propertyLabel(name) != null && value != null) {
                result.putIfAbsent(propertyLabel(name), value);
            }
        }
        return result;
    }

    private static String propertyLabel(String text) {
        if (text == null) {
            return null;
        }
        String lower = text.toLowerCase(Locale.ROOT);
        if (lower.equals("колір") || lower.equals("color") || lower.equals("colour")) {
            return "колір";
        }
        if (lower.startsWith("матеріал") || lower.startsWith("матріал") || lower.equals("склад")
                || lower.equals("material")) {
            return "матеріал";
        }
        return null;
    }

    static JsonNode first(JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }
        if (node.isArray()) {
            return node.isEmpty() ? null : node.get(0);
        }
        return node;
    }

    /** An object → one element; an array → its objects; else empty. */
    static List<JsonNode> list(JsonNode node) {
        List<JsonNode> result = new ArrayList<>();
        if (node == null || node.isNull()) {
            return result;
        }
        if (node.isArray()) {
            node.forEach(child -> {
                if (child.isObject()) {
                    result.add(child);
                }
            });
        } else if (node.isObject()) {
            result.add(node);
        }
        return result;
    }

    static String text(JsonNode node) {
        if (node == null || node.isNull() || node.isContainer()) {
            return null;
        }
        return node.asString();
    }

    private static String firstNonBlank(String a, String b) {
        String first = ImportText.clean(a);
        return first != null ? first : ImportText.clean(b);
    }
}
