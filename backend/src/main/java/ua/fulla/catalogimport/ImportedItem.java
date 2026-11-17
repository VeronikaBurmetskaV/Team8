package ua.fulla.catalogimport;

import java.util.List;
import ua.fulla.products.ProductColor;
import ua.fulla.products.ProductSize;

/**
 * One product as read from a source, already cleaned: name ≤ 100 chars, price 1…1 000 000 UAH,
 * {@code https://} photo URL, plain-text material and description. Lists are never null.
 */
record ImportedItem(
        String externalId,
        String brandName,
        String name,
        int priceUah,
        String photoUrl,
        String productUrl,
        boolean available,
        List<ProductSize> sizes,
        List<ProductColor> colors,
        String material,
        String description) {

    ImportedItem {
        sizes = List.copyOf(sizes);
        colors = List.copyOf(colors);
    }
}
