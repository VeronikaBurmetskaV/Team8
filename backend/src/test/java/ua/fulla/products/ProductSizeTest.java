package ua.fulla.products;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import tools.jackson.databind.json.JsonMapper;

/** The quantity rules of one size (data-model.md §5.3): unknown stays unknown, 0 is not unknown. */
class ProductSizeTest {

    static final JsonMapper JSON = JsonMapper.builder().build();

    @Test
    void withoutACountTheQuantityIsUnknown() {
        ProductSize size = new ProductSize("M", true);
        assertThat(size.quantity()).isNull();
        assertThat(size.available()).isTrue();
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 2, 3, 4, 5, 15})
    void aPositiveCountIsKeptOnAnAvailableSize(int quantity) {
        ProductSize size = new ProductSize("M", true, quantity);
        assertThat(size.quantity()).isEqualTo(quantity);
        assertThat(size.available()).isTrue();
    }

    @Test
    void zeroItemsMeansNotAvailableAndStaysAKnownZero() {
        ProductSize size = new ProductSize("M", true, 0);
        assertThat(size.available()).isFalse();
        assertThat(size.quantity()).as("known zero, not unknown").isZero();
    }

    @Test
    void aNegativeCountIsNotACount() {
        assertThat(new ProductSize("M", true, -1).quantity()).isNull();
        assertThat(new ProductSize("M", true, -1).available()).isTrue();
    }

    @Test
    void anUnavailableSizeWithItemsLeftContradictsItselfSoTheCountIsDropped() {
        ProductSize size = new ProductSize("M", false, 3);
        assertThat(size.available()).isFalse();
        assertThat(size.quantity()).isNull();
    }

    @Test
    void jsonLeavesAnUnknownQuantityOutAndKeepsAKnownOne() throws Exception {
        assertThat(JSON.writeValueAsString(new ProductSize("M", true)))
            .as("unchanged shape for sources without counts")
            .isEqualTo("{\"label\":\"M\",\"available\":true}");
        assertThat(JSON.writeValueAsString(new ProductSize("XS/S", true, 2)))
            .isEqualTo("{\"label\":\"XS/S\",\"available\":true,\"quantity\":2}");
        assertThat(JSON.writeValueAsString(new ProductSize("L", true, 0)))
            .isEqualTo("{\"label\":\"L\",\"available\":false,\"quantity\":0}");
    }

    @Test
    void oldStoredJsonWithoutAQuantityStillReads() throws Exception {
        ProductSize size = JSON.readValue("{\"label\":\"M\",\"available\":false}", ProductSize.class);
        assertThat(size).isEqualTo(new ProductSize("M", false));
    }
}
