package ua.fulla.catalogimport;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.BinaryOperator;
import java.util.regex.Pattern;
import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamException;
import javax.xml.stream.XMLStreamReader;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Element;
import ua.fulla.products.ProductColor;
import ua.fulla.products.ProductSize;

/**
 * A Google Merchant / Facebook catalogue XML feed (RSS or Atom with the {@code g:} namespace),
 * read with the JDK StAX parser (DTD and external entities off). Generic: used by the
 * Всі. Свої demo source (ADR-0014) and by the brand site import (ADR-0017). A feed has one
 * {@code <item>} per size and colour; the items of one product share {@code g:item_group_id}
 * (or, without it, {@code g:id}), which is the item's {@code externalId} here.
 */
final class MerchantFeed {

    private static final String G_NS = "http://base.google.com/ns/1.0";
    private static final Pattern MATERIAL_PREFIX = Pattern.compile("(?iu)^\\s*(склад|матеріал)\\s*:\\s*");

    /**
     * @param items   clothing products, at most {@code maxProducts}
     * @param links   the {@code g:link} of every product group of the feed (also beyond the
     *                cap when {@code scanAll}); used to tell which products the site still lists
     * @param skipped product groups that were not imported: not clothing, over the per-brand cap,
     *                not in UAH, or without a valid name, price, photo or link
     */
    record Parsed(List<ImportedItem> items, Set<String> links, int skipped) {}

    private MerchantFeed() {}

    /**
     * Reads product groups until {@code maxProducts} are collected: clothing only
     * ({@link ClothingFilter}) and at most {@code maxPerBrand} per {@code g:brand} value. Without
     * {@code scanAll} the rest of the feed is not read; with it the rest is only scanned for links.
     *
     * @param brandName {@code (g:brand, g:product_type)} → the brand name stored with the item
     */
    static Parsed parse(InputStream xml, int maxProducts, int maxPerBrand, boolean scanAll,
            BinaryOperator<String> brandName) throws IOException {
        XMLInputFactory factory = XMLInputFactory.newFactory();
        factory.setProperty(XMLInputFactory.SUPPORT_DTD, false);
        factory.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false);
        factory.setProperty(XMLInputFactory.IS_COALESCING, true);

        Map<String, Group> groups = new LinkedHashMap<>();
        Map<String, Integer> perBrand = new HashMap<>();
        Set<String> skipped = new HashSet<>();
        Set<String> links = new LinkedHashSet<>();
        Set<String> seenGroups = new HashSet<>();
        boolean capReached = false;
        try {
            XMLStreamReader reader = factory.createXMLStreamReader(xml);
            try {
                Map<String, String> fields = null;
                while (reader.hasNext()) {
                    int event = reader.next();
                    if (event == XMLStreamConstants.START_ELEMENT) {
                        String local = reader.getLocalName();
                        if (("item".equals(local) || "entry".equals(local)) && fields == null) {
                            fields = new HashMap<>();
                        } else if (fields != null && G_NS.equals(reader.getNamespaceURI())) {
                            fields.put(local, reader.getElementText());
                        }
                    } else if (event == XMLStreamConstants.END_ELEMENT && fields != null
                            && ("item".equals(reader.getLocalName()) || "entry".equals(reader.getLocalName()))) {
                        String groupId = firstNonBlank(fields.get("item_group_id"), fields.get("id"));
                        if (groupId != null && seenGroups.add(groupId)) {
                            String link = ImportText.clean(fields.get("link"));
                            if (link != null) {
                                links.add(link);
                            }
                        }
                        if (groupId != null && !skipped.contains(groupId) && !capReached) {
                            Group group = groups.get(groupId);
                            if (group == null && groups.size() >= maxProducts) {
                                capReached = true;
                                if (!scanAll) {
                                    break;
                                }
                            } else if (group == null) {
                                // Clothing only; the rest doesn't use up the brand's share.
                                String brandKey = String.valueOf(ImportText.clean(fields.get("brand")))
                                    .toLowerCase(Locale.ROOT);
                                if (!isClothing(fields, groupId)
                                        || perBrand.merge(brandKey, 1, Integer::sum) > maxPerBrand) {
                                    skipped.add(groupId);
                                } else {
                                    group = new Group(groupId.strip(), fields);
                                    groups.put(groupId, group);
                                }
                            }
                            if (group != null) {
                                group.add(fields);
                            }
                        }
                        fields = null;
                    }
                }
            } finally {
                reader.close();
            }
        } catch (XMLStreamException e) {
            throw new IOException("Feed is not valid XML: " + e.getMessage(), e);
        }

        List<ImportedItem> items = new ArrayList<>();
        int invalid = 0;
        for (Group group : groups.values()) {
            ImportedItem item = group.toItem(brandName);
            if (item != null) {
                items.add(item);
            } else {
                invalid++;
            }
        }
        return new Parsed(items, links, skipped.size() + invalid);
    }

    /** All feed items of one product (one per size/colour). The first one gives name, photo and link. */
    private static final class Group {
        private final String groupId;
        private final Map<String, String> first;
        private final Map<String, Boolean> sizes = new LinkedHashMap<>();
        private final List<ProductColor> colors = new ArrayList<>();
        private boolean anyAvailable;

        Group(String groupId, Map<String, String> first) {
            this.groupId = groupId;
            this.first = first;
        }

        void add(Map<String, String> fields) {
            boolean available = isInStock(fields.get("availability"));
            anyAvailable |= available;
            String size = ImportText.clean(fields.get("size"));
            if (size != null) {
                sizes.merge(size, available, Boolean::logicalOr);
            }
            for (ProductColor color : ImportText.colors(fields.get("color"))) {
                boolean known = colors.stream().anyMatch(c -> c.name().equalsIgnoreCase(color.name()));
                if (!known) {
                    colors.add(color);
                }
            }
        }

        /** Null when the item can't be a valid card (no name, price outside 1…1 000 000 or not UAH, no https photo). */
        ImportedItem toItem(BinaryOperator<String> brandName) {
            if (groupId.length() > ImportText.EXTERNAL_ID_MAX) {
                return null;
            }
            String brand = brandName.apply(first.get("brand"), first.get("product_type"));
            String name = ImportText.cardName(productName(first.get("title"), groupId, first.get("brand")));
            // The price the buyer pays now: the sale price when there is one.
            String rawPrice = firstNonBlank(first.get("sale_price"), first.get("price"));
            Integer price = ImportText.isUahPrice(rawPrice) ? ImportText.priceUah(rawPrice) : null;
            String photoUrl = ImportText.clean(first.get("image_link"));
            String productUrl = ImportText.clean(first.get("link"));
            if (name == null || price == null || !ImportText.isHttps(photoUrl) || !ImportText.isHttpUrl(productUrl)) {
                return null;
            }
            List<ProductSize> sizeList = new ArrayList<>();
            sizes.forEach((label, available) -> sizeList.add(new ProductSize(label, available)));
            String descriptionHtml = first.get("description");
            return new ImportedItem(
                groupId,
                brand,
                name,
                price,
                photoUrl,
                productUrl,
                anyAvailable,
                sizeList,
                colors,
                material(first.get("material"), descriptionHtml),
                ImportText.plainText(descriptionHtml, ImportText.DESCRIPTION_MAX));
        }
    }

    /** {@link ClothingFilter} on the cleaned name, {@code g:product_type} and {@code g:google_product_category}. */
    private static boolean isClothing(Map<String, String> fields, String groupId) {
        return ClothingFilter.isClothing(
            productName(fields.get("title"), groupId.strip(), fields.get("brand")),
            ImportText.clean(fields.get("product_type")),
            ImportText.clean(fields.get("google_product_category")));
    }

    private static boolean isInStock(String availability) {
        String value = availability == null ? "" : availability.strip().toLowerCase(Locale.ROOT);
        return value.equals("in_stock") || value.equals("in stock");
    }

    /**
     * Titles may look like «Футболка сіра з принтом Barricade Розмір L P-211-316-0064»: the group
     * ID, the size and the trailing raw {@code g:brand} value are removed.
     */
    static String productName(String title, String groupId, String brand) {
        String name = ImportText.clean(title);
        if (name == null) {
            return null;
        }
        if (name.endsWith(groupId)) {
            name = name.substring(0, name.length() - groupId.length()).strip();
        }
        int size = name.lastIndexOf(" Розмір ");
        if (size > 0) {
            name = name.substring(0, size).strip();
        }
        // Before «Розмір» comes the raw g:brand value (a brand name or the product type).
        String rawBrand = ImportText.clean(brand);
        if (rawBrand != null
                && name.toLowerCase(Locale.ROOT).endsWith(" " + rawBrand.toLowerCase(Locale.ROOT))) {
            name = name.substring(0, name.length() - rawBrand.length()).strip();
        }
        return name;
    }

    /** {@code g:material} without «Склад:»; if empty, the composition line of the description. */
    static String material(String material, String descriptionHtml) {
        String value = ImportText.clean(material);
        if (value != null) {
            value = MATERIAL_PREFIX.matcher(value).replaceFirst("");
        }
        if ((value == null || value.isEmpty()) && descriptionHtml != null) {
            for (Element li : Jsoup.parse(descriptionHtml).select("li")) {
                String text = ImportText.clean(li.text());
                if (text == null) {
                    continue;
                }
                String lower = text.toLowerCase(Locale.ROOT);
                if (lower.startsWith("material composition") || lower.startsWith("склад")
                        || lower.startsWith("матеріал")) {
                    int colon = text.indexOf(':');
                    value = colon >= 0 ? text.substring(colon + 1).strip() : text;
                    break;
                }
            }
        }
        return ImportText.limit(value, ImportText.MATERIAL_MAX);
    }

    static String firstNonBlank(String a, String b) {
        String first = ImportText.clean(a);
        return first != null ? first : ImportText.clean(b);
    }
}
