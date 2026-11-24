package ua.fulla.catalogimport;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import org.junit.jupiter.api.Test;
import ua.fulla.products.ProductColor;

/** Cleaning rules of data-model.md §5.3 and the hard limits of ADR-0014. */
class ImportTextTest {

    @Test
    void pricesAreWholeUahInRange() {
        assertThat(ImportText.priceUah("1500 UAH")).isEqualTo(1500);
        assertThat(ImportText.priceUah("1 499,50 грн")).isEqualTo(1500);
        assertThat(ImportText.priceUah("749.49")).isEqualTo(749);
        assertThat(ImportText.priceUah("1000000")).isEqualTo(1_000_000);
        assertThat(ImportText.priceUah("1000001")).isNull();
        assertThat(ImportText.priceUah("0 UAH")).isNull();
        assertThat(ImportText.priceUah("ціна за запитом")).isNull();
        assertThat(ImportText.priceUah(null)).isNull();
    }

    @Test
    void longNamesAreCutAtAWordBoundary() {
        String name = "Сукня ".repeat(30);
        String cut = ImportText.cardName(name);

        assertThat(cut).hasSizeLessThanOrEqualTo(100).endsWith("Сукня").doesNotEndWith(" ");
        assertThat(ImportText.cardName("  Худі   чорне ")).isEqualTo("Худі чорне");
        assertThat(ImportText.cardName("   ")).isNull();
    }

    @Test
    void htmlEntitiesInNamesAreDecoded() {
        assertThat(ImportText.cardName("Пуховик укорочений з дов&#039;язом білий"))
            .isEqualTo("Пуховик укорочений з дов'язом білий");
    }

    @Test
    void colourNamesGetHexFromTheFixedTableOrNull() {
        assertThat(ImportText.colors("Бежевий, бузковий, Пісочний, One color, бежевий")).containsExactly(
            new ProductColor("Бежевий", "#D9C4A5"),
            new ProductColor("бузковий", "#C8A2C8"),
            new ProductColor("Пісочний", null));
    }

    @Test
    void htmlBecomesPlainText() {
        assertThat(ImportText.plainText("<p>Рядок&nbsp;1</p><p>Рядок <b>2</b><br>Рядок 3</p>", 5000))
            .isEqualTo("Рядок 1\nРядок 2\nРядок 3");
        assertThat(ImportText.plainText("<img src=x onerror=alert(1)>", 5000)).isNull();
        assertThat(ImportText.plainText("a".repeat(6000), 5000)).hasSize(5000);
    }

    @Test
    void configuredLimitsCannotExceedTheAdr() {
        var properties = new ImportProperties(true, Duration.ofMillis(100), 500, 1000, null, null);

        assertThat(properties.delay()).isEqualTo(Duration.ofSeconds(2));
        assertThat(properties.maxProducts()).isEqualTo(50);
        assertThat(properties.maxRequests()).isEqualTo(100);
    }
}
