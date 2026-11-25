package ua.fulla.catalogimport;

import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import ua.fulla.products.ProductColor;
import ua.fulla.products.ProductSize;

/**
 * Shopify's public {@code /products.json} (ADR-0017): {@code products[]} with {@code handle},
 * {@code title}, {@code body_html}, {@code product_type}, {@code variants[]} (price,
 * {@code available}, {@code option1…3}), {@code options[]} and {@code images[]}. Prices are
 * taken as UAH (the file names no currency; Ukrainian shops sell in UAH).
 */
final class ShopifyProducts {

    private static final Pattern SIZE_OPTION = Pattern.compile("(?iu)size|розмір|размер");
    private static final Pattern COLOR_OPTION = Pattern.compile("(?iu)colou?r|колір|цвет");

    /**
     * @param items   clothing products, at most {@code maxProducts}
     * @param links   {@code <base>/products/<handle>} of every product in the file
     * @param skipped products of the file that were read but not imported
     * @param total   products in the file (a full page means there may be more pages)
     */
    record Parsed(List<ImportedItem> items, Set<String> links, int skipped, int total) {}

    private ShopifyProducts() {}

    /** Null when the text is not a Shopify {@code products.json} (e.g. an HTML page or a 404 page). */
    static Parsed parse(String json, URI baseUrl, String brandName, int maxProducts) {
        JsonNode root;
        try {
            root = JsonLdProducts.LENIENT_JSON.readTree(json);
        } catch (JacksonException e) {
            return null;
        }
        JsonNode products = root == null ? null : root.get("products");
        if (products == null || !products.isArray()) {
            return null;
        }
        List<ImportedItem> items = new ArrayList<>();
        Set<String> links = new LinkedHashSet<>();
        int skipped = 0;
        for (JsonNode product : products) {
            String handle = ImportText.clean(JsonLdProducts.text(product.get("handle")));
            if (handle == null) {
                continue;
            }
            String productUrl = baseUrl.resolve("/products/" + handle).toString();
            links.add(productUrl);
            if (items.size() >= maxProducts) {
                continue;
            }
            ImportedItem item = toItem(product, productUrl, brandName);
            if (item == null) {
                skipped++;
            } else {
                items.add(item);
            }
        }
        return new Parsed(items, links, skipped, products.size());
    }

    private static ImportedItem toItem(JsonNode product, String productUrl, String brandName) {
        String name = ImportText.cardName(JsonLdProducts.text(product.get("title")));
        String type = ImportText.clean(JsonLdProducts.text(product.get("product_type")));
        if (!ClothingFilter.isClothing(name, type, null)) {
            return null;
        }
        List<JsonNode> variants = JsonLdProducts.list(product.get("variants"));
        Integer price = null;
        boolean anyAvailable = false;
        for (JsonNode variant : variants) {
            Integer p = ImportText.priceUah(JsonLdProducts.text(variant.get("price")));
            boolean available = isAvailable(variant);
            anyAvailable |= available;
            // The lowest price among the sizes in stock; the first price when none is in stock.
            if (p != null && (price == null || (available && p < price))) {
                price = p;
            }
        }
        String photoUrl = photo(product);
        if (name == null || price == null || !ImportText.isHttps(photoUrl)) {
            return null;
        }
        int sizeOption = optionPosition(product, SIZE_OPTION);
        int colorOption = optionPosition(product, COLOR_OPTION);
        Map<String, Boolean> sizes = new LinkedHashMap<>();
        Set<String> colorNames = new LinkedHashSet<>();
        for (JsonNode variant : variants) {
            if (sizeOption > 0) {
                String label = ImportText.clean(JsonLdProducts.text(variant.get("option" + sizeOption)));
                if (label != null) {
                    sizes.merge(label, isAvailable(variant), Boolean::logicalOr);
                }
            }
            if (colorOption > 0) {
                String color = ImportText.clean(JsonLdProducts.text(variant.get("option" + colorOption)));
                if (color != null) {
                    colorNames.add(color);
                }
            }
        }
        List<ProductSize> sizeList = new ArrayList<>();
        sizes.forEach((label, available) -> sizeList.add(new ProductSize(label, available)));
        List<ProductColor> colors = ImportText.colors(String.join(", ", colorNames));
        return new ImportedItem(
            productUrl,
            brandName,
            name,
            price,
            photoUrl,
            productUrl,
            anyAvailable || variants.isEmpty(),
            sizeList,
            colors,
            null,
            ImportText.plainText(JsonLdProducts.text(product.get("body_html")), ImportText.DESCRIPTION_MAX));
    }

    private static boolean isAvailable(JsonNode variant) {
        JsonNode available = variant.get("available");
        return available == null || available.isNull() || available.asBoolean();
    }

    /** {@code images[0].src}; Shopify may give {@code //cdn.shopify.com/…} without a scheme. */
    private static String photo(JsonNode product) {
        JsonNode image = JsonLdProducts.first(product.get("images"));
        String src = image == null ? null
            : ImportText.clean(image.isObject() ? JsonLdProducts.text(image.get("src")) : JsonLdProducts.text(image));
        if (src != null && src.startsWith("//")) {
            src = "https:" + src;
        }
        return src;
    }

    /** The 1-based position of the option whose name matches, or 0. */
    private static int optionPosition(JsonNode product, Pattern name) {
        List<JsonNode> options = JsonLdProducts.list(product.get("options"));
        for (int i = 0; i < options.size(); i++) {
            String optionName = ImportText.clean(JsonLdProducts.text(options.get(i).get("name")));
            if (optionName != null && name.matcher(optionName.toLowerCase(Locale.ROOT)).find()) {
                JsonNode position = options.get(i).get("position");
                return position != null && position.isNumber() ? position.asInt() : i + 1;
            }
        }
        return 0;
    }
}
