package ua.fulla.catalogimport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.net.URI;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import ua.fulla.products.ProductColor;
import ua.fulla.products.ProductSize;

/** The generic brand-site importer (ADR-0017) on local fixtures in a fake web. */
class GenericSiteImporterTest {

    static final URI HOME = URI.create("https://brand.ua/");
    static final String FEED = "https://brand.ua/feed.xml";
    static final String SHOPIFY = "https://brand.ua/products.json?limit=250";

    final FakeWeb web = new FakeWeb();

    // ---------- 1. feed ----------

    @Test
    void feedOfTheBrandIsReadFirst() throws IOException {
        web.fixture(FEED, "application/xml", "feed.xml");

        ImportBatch batch = fetch(FEED);

        assertThat(batch.method()).isEqualTo("feed");
        assertThat(batch.sourceUrl()).isEqualTo(FEED);
        assertThat(batch.complete()).isTrue();
        Map<String, ImportedItem> items = byId(batch);
        assertThat(items).containsOnlyKeys("/products/linen-dress", "/products/wool-jacket");

        ImportedItem dress = items.get("/products/linen-dress");
        assertThat(dress.name()).isEqualTo("Лляна сукня міді");
        assertThat(dress.priceUah()).isEqualTo(2400);
        assertThat(dress.photoUrl()).isEqualTo("https://cdn.brand.ua/dress.jpg");
        assertThat(dress.productUrl()).isEqualTo("https://brand.ua/products/linen-dress?variant=11&utm_source=feed");
        assertThat(dress.sizes()).containsExactly(new ProductSize("S", true), new ProductSize("M", false));
        assertThat(dress.colors()).containsExactly(new ProductColor("бежевий", "#D9C4A5"));
        assertThat(dress.material()).isEqualTo("льон 100%");
        assertThat(dress.description()).isEqualTo("Сукня з льону.\nСклад: льон 100%");
        assertThat(dress.available()).isTrue();
        assertThat(items.get("/products/wool-jacket").priceUah()).as("sale price").isEqualTo(3500);

        // The USD T-shirt and the mug are skipped, but listed (so they are never "missing").
        assertThat(batch.skipped()).isEqualTo(2);
        assertThat(batch.listedIds()).containsExactlyInAnyOrder("/products/linen-dress", "/products/wool-jacket",
            "/products/basic-tee", "/products/mug");
        assertThat(web.requestedUrls()).doesNotContain(SHOPIFY);
    }

    @Test
    void productCapStillListsEveryProductOfTheFeed() throws IOException {
        web.fixture(FEED, "application/xml", "feed.xml");

        ImportBatch batch = fetch(FEED, 1);

        assertThat(batch.items()).hasSize(1);
        assertThat(batch.listedIds()).hasSize(4);
    }

    @Test
    void missingFeedFallsBackToShopify() throws IOException {
        web.fixture(SHOPIFY, "application/json", "shopify-products.json");

        assertThat(fetch(FEED).method()).isEqualTo("shopify");
    }

    // ---------- 2. Shopify ----------

    @Test
    void shopifyProductsJson() throws IOException {
        web.fixture(SHOPIFY, "application/json; charset=utf-8", "shopify-products.json");

        ImportBatch batch = fetch(null);

        assertThat(batch.method()).isEqualTo("shopify");
        assertThat(batch.sourceUrl()).isEqualTo(SHOPIFY);
        assertThat(batch.complete()).as("fewer than 250 products: the whole listing").isTrue();
        Map<String, ImportedItem> items = byId(batch);
        assertThat(items).containsOnlyKeys("/products/linen-shirt-dress", "/products/oversize-hoodie");

        ImportedItem dress = items.get("/products/linen-shirt-dress");
        assertThat(dress.name()).isEqualTo("Сукня-сорочка з льону");
        assertThat(dress.priceUah()).as("lowest price in stock").isEqualTo(3100);
        assertThat(dress.photoUrl()).isEqualTo("https://cdn.shopify.com/s/files/dress.jpg");
        assertThat(dress.productUrl()).isEqualTo("https://brand.ua/products/linen-shirt-dress");
        assertThat(dress.sizes()).containsExactly(
            new ProductSize("XS", false), new ProductSize("S", true), new ProductSize("M", true));
        assertThat(dress.colors()).containsExactly(new ProductColor("білий", "#FFFFFF"));
        assertThat(dress.description()).isEqualTo("Вільний крій.\nЛьон 100%");

        assertThat(items.get("/products/oversize-hoodie").available()).as("all sizes sold out").isFalse();
        assertThat(batch.skipped()).as("the gift card").isEqualTo(1);
        assertThat(batch.listedIds()).hasSize(3);
        assertThat(web.requestedUrls()).doesNotContain("https://brand.ua/sitemap.xml");
    }

    @Test
    void htmlAtProductsJsonIsNotShopify() throws IOException {
        web.html(SHOPIFY, "<html>Not found</html>");
        sitemapSite();

        assertThat(fetch(null).method()).isEqualTo("sitemap");
    }

    // ---------- 3. sitemap + JSON-LD ----------

    @Test
    void sitemapIndexToProductPagesWithJsonLd() throws IOException {
        sitemapSite();

        ImportBatch batch = fetch(null);

        assertThat(batch.method()).isEqualTo("sitemap");
        assertThat(batch.sourceUrl()).isNull();
        assertThat(batch.complete()).isTrue();
        Map<String, ImportedItem> items = byId(batch);
        assertThat(items).containsOnlyKeys("/product/knit-cardigan", "/product/silk-skirt");

        ImportedItem cardigan = items.get("/product/knit-cardigan");
        assertThat(cardigan.name()).isEqualTo("Кардиган в'язаний");
        assertThat(cardigan.priceUah()).isEqualTo(2800);
        assertThat(cardigan.sizes()).containsExactly(new ProductSize("S", true), new ProductSize("M", false));
        assertThat(cardigan.colors()).containsExactly(new ProductColor("сірий", "#9E9E9E"));
        assertThat(cardigan.material()).isEqualTo("Вовна 70%, акрил 30%");
        assertThat(cardigan.available()).isTrue();

        ImportedItem skirt = items.get("/product/silk-skirt");
        assertThat(skirt.priceUah()).isEqualTo(1950);
        assertThat(skirt.photoUrl()).isEqualTo("https://cdn.brand.ua/skirt.jpg");
        assertThat(skirt.productUrl()).isEqualTo("https://brand.ua/product/silk-skirt/");

        assertThat(batch.skipped()).as("the candle").isEqualTo(1);
        // Only the product sitemap of the own domain was read; the foreign URL is not listed.
        assertThat(web.requestedUrls()).doesNotContain("https://brand.ua/sitemap-pages.xml")
            .noneMatch(url -> url.contains("evil") || url.contains("other-shop"));
        assertThat(batch.listedIds()).containsExactlyInAnyOrder("/product/knit-cardigan", "/product/silk-skirt",
            "/product/candle", "/product/removed");
    }

    @Test
    void unreadableChildSitemapMakesTheListingIncomplete() throws IOException {
        sitemapSite();
        web.status("https://brand.ua/sitemap-products.xml", 500);
        web.fixture("https://brand.ua/sitemap.xml", "application/xml", "sitemap-index.xml");

        assertThat(fetch(null)).as("no product pages at all").satisfies(b -> assertThat(b.method()).isNull());
    }

    // ---------- nothing found ----------

    @Test
    void siteWithoutAnySourceGivesAnEmptyBatch() throws IOException {
        ImportBatch batch = fetch(null);

        assertThat(batch.method()).isNull();
        assertThat(batch.items()).isEmpty();
    }

    @Test
    void networkErrorEverywhereIsThrown() {
        web.status(SHOPIFY, 500).status("https://brand.ua/sitemap.xml", 500);

        assertThatThrownBy(() -> fetch(null)).isInstanceOf(IOException.class);
    }

    // ---------- IDs ----------

    @Test
    void externalIdIsThePathWithoutTrackingAndVariant() {
        assertThat(GenericSiteImporter.externalIdFor("https://brand.ua/products/a?variant=3&utm_source=x"))
            .isEqualTo("/products/a");
        assertThat(GenericSiteImporter.externalIdFor("https://www.brand.ua/products/a/")).isEqualTo("/products/a");
        assertThat(GenericSiteImporter.externalIdFor("https://brand.ua/index.php?route=product&product_id=42"))
            .isEqualTo("/index.php?route=product&product_id=42");
        String longId = GenericSiteImporter.externalIdFor("https://brand.ua/" + "a".repeat(150));
        assertThat(longId).startsWith("sha256:").hasSizeLessThanOrEqualTo(100);
    }

    private void sitemapSite() {
        web.fixture("https://brand.ua/sitemap.xml", "application/xml", "sitemap-index.xml")
            .fixture("https://brand.ua/sitemap-products.xml", "text/xml", "sitemap-products.xml")
            .fixture("https://brand.ua/product/knit-cardigan", "text/html", "page-cardigan.html")
            .fixture("https://brand.ua/product/silk-skirt/", "text/html", "page-skirt.html")
            .fixture("https://brand.ua/product/candle", "text/html", "page-candle.html");
    }

    private ImportBatch fetch(String feedUrl) throws IOException {
        return fetch(feedUrl, 50);
    }

    private ImportBatch fetch(String feedUrl, int max) throws IOException {
        PoliteFetcher fetcher = web.fetcher("brand.ua", 100);
        fetcher.loadRobots();
        return new GenericSiteImporter(HOME, feedUrl, "Lileya").fetch(fetcher, max);
    }

    private static Map<String, ImportedItem> byId(ImportBatch batch) {
        return batch.items().stream().collect(Collectors.toMap(ImportedItem::externalId, Function.identity()));
    }
}
