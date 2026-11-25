package ua.fulla.catalogimport;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.util.List;
import java.util.Locale;

/**
 * Всі. Свої (a marketplace of Ukrainian brands): the Google Merchant XML feed
 * {@code /facebook-feed.xml}, parsed by the generic {@link MerchantFeed}. Items of one product
 * share {@code g:item_group_id}, which is the card's {@code external_id}; the brand is
 * {@code g:brand} with the marketplace's own name as the fallback.
 */
class VsiSvoiFeedImporter implements CatalogImporter {

    static final String CODE = "vsisvoi";
    static final String FEED_PATH = "/facebook-feed.xml";
    static final String FALLBACK_BRAND = "Всі. Свої";
    static final long FEED_MAX_BYTES = 30L * 1024 * 1024;

    private final URI baseUrl;

    VsiSvoiFeedImporter(URI baseUrl) {
        this.baseUrl = baseUrl;
    }

    @Override
    public String code() {
        return CODE;
    }

    @Override
    public URI baseUrl() {
        return baseUrl;
    }

    @Override
    public ImportBatch fetch(PoliteFetcher fetcher, int maxProducts) throws IOException {
        List<ImportedItem> items = fetcher.getStream(baseUrl.resolve(FEED_PATH).toString(), FEED_MAX_BYTES,
            body -> parse(body, maxProducts));
        if (items == null) {
            throw new IOException("Feed is missing or disallowed by robots.txt");
        }
        return new ImportBatch(items, true);
    }

    static List<ImportedItem> parse(InputStream xml, int maxProducts) throws IOException {
        return parse(xml, maxProducts, ImportProperties.MAX_PRODUCTS_PER_BRAND);
    }

    /**
     * Reads products until {@code maxProducts} groups are collected: clothing only and at most
     * {@code maxPerBrand} per {@code g:brand} value; the rest of the feed is not read
     * ({@link MerchantFeed}).
     */
    static List<ImportedItem> parse(InputStream xml, int maxProducts, int maxPerBrand) throws IOException {
        return MerchantFeed.parse(xml, maxProducts, maxPerBrand, false, VsiSvoiFeedImporter::brandName).items();
    }

    /**
     * {@code g:brand}, unless it is missing, of the wrong length (2–50) or just the product type
     * (e.g. «Капелюх» for «Жіночі капелюхи»): then the marketplace's own name (data-model.md §5.2).
     */
    static String brandName(String brand, String productType) {
        String name = ImportText.clean(brand);
        if (name == null || name.length() < 2 || name.length() > 50) {
            return FALLBACK_BRAND;
        }
        String type = ImportText.clean(productType);
        if (type != null && type.toLowerCase(Locale.ROOT).contains(name.toLowerCase(Locale.ROOT))) {
            return FALLBACK_BRAND;
        }
        return name;
    }
}
