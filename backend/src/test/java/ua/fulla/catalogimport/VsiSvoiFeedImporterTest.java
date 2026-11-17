package ua.fulla.catalogimport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.Test;
import ua.fulla.products.ProductColor;
import ua.fulla.products.ProductSize;

/** Parsing of the saved Всі. Свої feed sample (no network). */
class VsiSvoiFeedImporterTest {

    static List<ImportedItem> parseAll() throws IOException {
        return VsiSvoiFeedImporter.parse(Fixtures.stream("vsisvoi-feed.xml"), 50);
    }

    @Test
    void itemsOfOneGroupBecomeOneCardWithSizesInFeedOrder() throws IOException {
        ImportedItem tee = parseAll().getFirst();

        assertThat(tee.externalId()).isEqualTo("P-211-316-0001");
        assertThat(tee.name()).isEqualTo("Футболка сіра з принтом");
        assertThat(tee.brandName()).isEqualTo("Barricade");
        assertThat(tee.priceUah()).as("sale price, rounded half-up").isEqualTo(750);
        assertThat(tee.photoUrl()).isEqualTo("https://media2.vsisvoi.ua/uploads/catalog/products/0001/gallery/a.jpg");
        assertThat(tee.productUrl()).isEqualTo("https://vsisvoi.ua/store/futbolka-sira-p-211-316-0001");
        assertThat(tee.available()).isTrue();
        assertThat(tee.sizes()).containsExactly(
            new ProductSize("M", true), new ProductSize("L", false), new ProductSize("XL", true));
        assertThat(tee.colors()).containsExactly(new ProductColor("сірий", "#9E9E9E"));
        assertThat(tee.material()).as("empty g:material → composition line of the description")
            .isEqualTo("100% Бавовна");
        assertThat(tee.description()).isEqualTo("Фасон: оверсайз\nКолір: сірий\nMaterial composition: 100% Бавовна");
    }

    @Test
    void productTypeInsteadOfBrandFallsBackToTheMarketplaceName() throws IOException {
        ImportedItem jacket = parseAll().get(2);

        assertThat(jacket.externalId()).isEqualTo("P-309-237-0012");
        assertThat(jacket.brandName()).isEqualTo("Всі. Свої");
        assertThat(jacket.name()).isEqualTo("Жіночий бежевий жакет");
        assertThat(jacket.sizes()).containsExactly(new ProductSize("55", true), new ProductSize("57", true));
        assertThat(jacket.colors()).as("colours of all items, without «One color»").containsExactly(
            new ProductColor("бежевий", "#D9C4A5"), new ProductColor("чорний", "#1A1A1A"));
        assertThat(jacket.material()).isEqualTo("100% Вовна");
    }

    @Test
    void groupWithoutAnySizeInStockIsNotAvailable() throws IOException {
        ImportedItem dress = parseAll().get(3);

        assertThat(dress.externalId()).isEqualTo("P-100-200-0003");
        assertThat(dress.available()).isFalse();
        assertThat(dress.colors()).as("unknown colour name → hex null").containsExactly(new ProductColor("Пісочний", null));
        assertThat(dress.description()).as("entities decoded, no tags").isEqualTo("Лляна сукня & пояс");
    }

    @Test
    void onlyClothingWithAPriceAndAnHttpsPhotoIsImported() throws IOException {
        // Skipped: underwear, a lingerie top (by its category), a tattoo, a mug, a certificate
        // (not clothing) and a shirt with an http:// photo.
        assertThat(parseAll()).extracting(ImportedItem::externalId).containsExactly(
            "P-211-316-0001", "P-211-316-0002", "P-309-237-0012", "P-100-200-0003", "P-100-200-0006");
    }

    @Test
    void readingStopsAfterTheProductLimit() throws IOException {
        List<ImportedItem> items = VsiSvoiFeedImporter.parse(Fixtures.stream("vsisvoi-feed.xml"), 2);

        assertThat(items).extracting(ImportedItem::externalId).containsExactly("P-211-316-0001", "P-211-316-0002");
        assertThat(items.getFirst().sizes()).as("all items of a group still count").hasSize(3);
    }

    @Test
    void eachBrandGivesAtMostItsShareOfTheProducts() throws IOException {
        // Barricade's second T-shirt is over its share of 1. ctrl's certificate is not clothing,
        // so it doesn't use up ctrl's share and the hoodie still comes in.
        List<ImportedItem> items = VsiSvoiFeedImporter.parse(Fixtures.stream("vsisvoi-feed.xml"), 50, 1);

        assertThat(items).extracting(ImportedItem::externalId)
            .containsExactly("P-211-316-0001", "P-309-237-0012", "P-100-200-0003", "P-100-200-0006");
    }

    @Test
    void externalEntitiesAreNotResolved() {
        String xml = """
            <?xml version="1.0"?>
            <!DOCTYPE rss [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
            <rss xmlns:g="http://base.google.com/ns/1.0"><channel><item>
            <g:item_group_id>X</g:item_group_id><g:title>&xxe;</g:title>
            </item></channel></rss>
            """;

        assertThatThrownBy(() -> VsiSvoiFeedImporter.parse(
                new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)), 50))
            .isInstanceOf(IOException.class);
    }
}
