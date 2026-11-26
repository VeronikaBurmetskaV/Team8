package ua.fulla.products;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * One size of an imported card, in site order: {@code {"label":"M","available":true}}, plus
 * {@code "quantity":2} only when the source states the exact number of items left in that size
 * (data-model.md §5.3). {@code quantity == null} means unknown and is left out of the JSON;
 * it is never turned into 0. The rules are applied here, so every importer obeys them:
 * <ul>
 *   <li>a negative quantity is not a count → unknown;</li>
 *   <li>0 items → the size is not available (the 0 is kept: known to be zero);</li>
 *   <li>a size that is not available but has items left contradicts itself → the availability
 *       wins and the count is dropped as unreliable.</li>
 * </ul>
 */
public record ProductSize(String label, boolean available, @JsonInclude(JsonInclude.Include.NON_NULL) Integer quantity) {

    public ProductSize {
        if (quantity != null && quantity < 0) {
            quantity = null;
        }
        if (quantity != null && quantity == 0) {
            available = false;
        }
        if (!available && quantity != null && quantity > 0) {
            quantity = null;
        }
    }

    /** A size whose number of items is unknown (every source without counts). */
    public ProductSize(String label, boolean available) {
        this(label, available, null);
    }
}
