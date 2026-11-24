package ua.fulla.buyer;

import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * SQL for {@code buyer_accounts} (data-model.md §2.5). A separate table from brand accounts, so
 * one email may be a brand and a buyer (ADR-0012). The email must already be normalized (T-10).
 */
@Repository
class BuyerAccountRepository {

    private final JdbcClient jdbc;

    BuyerAccountRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Inserts the account and returns its ID. A taken email fails on the UNIQUE index
     * with DuplicateKeyException; there is no check before the insert (NFR-04).
     */
    UUID insert(String email, String passwordHash) {
        return jdbc.sql("INSERT INTO buyer_accounts (email, password_hash) VALUES (:email, :passwordHash) RETURNING id")
            .param("email", email)
            .param("passwordHash", passwordHash)
            .query(UUID.class)
            .single();
    }
}
