package ua.fulla.catalogimport;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.net.URI;
import org.junit.jupiter.api.Test;
import ua.fulla.catalogimport.JsonLdSitemapImporter.Site;
import ua.fulla.products.ProductColor;
import ua.fulla.products.ProductSize;

/** Parsing of the saved One By One and Cher'17 samples (no network). */
class JsonLdSitemapImporterTest {

    static final JsonLdSitemapImporter ONE_BY_ONE =
        new JsonLdSitemapImporter("onebyone", URI.create("https://onebyone.ua"), "One By One", Site.ONE_BY_ONE);
    static final JsonLdSitemapImporter CHER17 =
        new JsonLdSitemapImporter("cher17", URI.create("https://cher17.com"), "CHER'17", Site.CHER17);

    // ---------- sitemaps ----------

    @Test
    void oneByOneSitemapGivesUkrainianProductPagesNewestFirst() throws IOException {
        assertThat(ONE_BY_ONE.productUrls(Fixtures.text("onebyone-sitemap.xml"))).containsExactly(
            "https://onebyone.ua/suknja-atlasna-rozhevogo-koloru",
            "https://onebyone.ua/futbolka-bazova-biloho-koloru");
    }

    @Test
    void cher17SitemapGivesOnlyProductPages() throws IOException {
        assertThat(CHER17.productUrls(Fixtures.text("cher17-sitemap.xml"))).containsExactly(
            "https://cher17.com/product/puhovik-ukorochenij-chornij",
            "https://cher17.com/product/grebinec-bezhevij");
    }

    // ---------- product pages ----------

    @Test
    void oneByOneProductPage() {
        String url = "https://onebyone.ua/suknja-atlasna-rozhevogo-koloru";
        ImportedItem item = ONE_BY_ONE.parseProduct(Fixtures.text("onebyone-product.html"), url).orElseThrow();

        assertThat(item.externalId()).isEqualTo("/suknja-atlasna-rozhevogo-koloru");
        assertThat(item.brandName()).isEqualTo("One By One");
        assertThat(item.name()).isEqualTo("Сукня атласна рожевого кольору з мереживом");
        assertThat(item.priceUah()).isEqualTo(6990);
        assertThat(item.photoUrl()).isEqualTo("https://onebyone.ua/image/catalog/00000048392/1.jpg");
        assertThat(item.productUrl()).isEqualTo(url);
        assertThat(item.available()).as("PreOrder can be ordered").isTrue();
        assertThat(item.sizes()).containsExactly(
            new ProductSize("XS", true), new ProductSize("S", false), new ProductSize("M", true));
        assertThat(item.colors()).containsExactly(new ProductColor("Рожевий", "#F2B8C6"));
        assertThat(item.material()).isEqualTo("Матеріал верху: Поліестер 95%, Еластан 5%; Матеріал підкладки: Віскоза 100%");
        assertThat(item.description()).contains("OneByOne & мереживо");
    }

    @Test
    void soldOutOneByOnePageIsNotAvailable() {
        ImportedItem item = ONE_BY_ONE.parseProduct(Fixtures.text("onebyone-product-sold-out.html"),
            "https://onebyone.ua/kardigan-z-kishenjami-bezhevogo-koloru").orElseThrow();

        assertThat(item.available()).isFalse();
        assertThat(item.sizes()).containsExactly(new ProductSize("ONE SIZE", false));
        assertThat(item.priceUah()).isEqualTo(650);
        assertThat(item.material()).isNull();
    }

    @Test
    void cher17ProductPageWithRawLineBreaksInJsonLd() {
        String url = "https://cher17.com/product/puhovik-ukorochenij-chornij";
        ImportedItem item = CHER17.parseProduct(Fixtures.text("cher17-product.html"), url).orElseThrow();

        assertThat(item.externalId()).isEqualTo("/product/puhovik-ukorochenij-chornij");
        assertThat(item.brandName()).isEqualTo("CHER'17");
        assertThat(item.name()).isEqualTo("Пуховик укорочений з капюшоном чорний");
        assertThat(item.priceUah()).as("AggregateOffer.lowPrice").isEqualTo(7599);
        assertThat(item.photoUrl())
            .isEqualTo("https://cher17.fra1.cdn.digitaloceanspaces.com/public/products/media/1/1.jpg");
        assertThat(item.available()).isTrue();
        assertThat(item.sizes()).as("only the size picker, not the copies for cart and shop stock").containsExactly(
            new ProductSize("XS/S", true), new ProductSize("M/L", false), new ProductSize("XL", true));
        assertThat(item.colors()).as("HTML wins over additionalProperty")
            .containsExactly(new ProductColor("чорний", "#1A1A1A"));
        assertThat(item.material()).isEqualTo("Матеріал основний: поліестер-100%; Підкладка: віскоза-100%");
        assertThat(item.description())
            .isEqualTo("На моделі розмір: XS\nТемпературний режим від 0°C до -10°C\n(рекомендовано)")
            .doesNotContain("<", "onclick");
    }

    @Test
    void additionalPropertyIsUsedWhenTheHtmlHasNoDetails() {
        String html = Fixtures.text("cher17-product.html")
            .replaceAll("(?s)<div class=\"product-main-detail__item accordion\">.*</body>", "</body>");
        ImportedItem item = CHER17.parseProduct(html, "https://cher17.com/product/puhovik-ukorochenij-chornij")
            .orElseThrow();

        assertThat(item.material()).isEqualTo("поліестер-100%");
        assertThat(item.colors()).containsExactly(new ProductColor("молочний", "#F3EEE2"));
    }

    @Test
    void productThatIsNotClothingIsSkipped() {
        String html = Fixtures.text("cher17-product.html")
            .replace("Пуховик укорочений з капюшоном чорний", "Гребінець для одягу бежевий");

        assertThat(CHER17.parseProduct(html, "https://cher17.com/product/grebinec-bezhevij")).isEmpty();
    }

    @Test
    void pageWithoutProductJsonLdIsSkipped() {
        assertThat(CHER17.parseProduct("<html><body><h1>Каталог</h1></body></html>",
            "https://cher17.com/product/x")).isEmpty();
    }
}
