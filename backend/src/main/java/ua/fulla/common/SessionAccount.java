package ua.fulla.common;

import java.io.Serializable;
import java.util.UUID;

/**
 * The principal kept in the HTTP session: a brand or a buyer, never both (ADR-0006).
 * Controllers read the owner ID from here, never from the request (INV-07).
 */
public record SessionAccount(AccountType accountType, UUID accountId, String email) implements Serializable {

    public enum AccountType {
        BRAND,
        BUYER
    }
}
