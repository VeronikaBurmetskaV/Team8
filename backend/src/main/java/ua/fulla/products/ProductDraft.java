package ua.fulla.products;

import java.util.UUID;

/**
 * The fields a brand writes into a card, already checked by Bean Validation. The URLs are kept
 * exactly as entered (no UTM, US-26); exactly one photo source is set.
 */
record ProductDraft(String name, int priceUah, UUID photoImageId, String photoUrl, String productUrl) {

    /** The name is saved the way it was validated: trimmed (CardNameValidator). */
    ProductDraft {
        name = CardNameValidator.normalize(name);
    }
}
