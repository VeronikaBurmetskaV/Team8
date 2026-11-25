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
     * Inserts the account and returns its ID: exactly one of email / phone is given (already
     * normalized), the name may be null. A taken email or phone fails on its UNIQUE index with
     * DuplicateKeyException; there is no check before the insert (NFR-04).
     */
    UUID insert(String email, String phone, String passwordHash, String displayName) {
        return jdbc.sql("""
                INSERT INTO buyer_accounts (email, phone, password_hash, display_name)
                VALUES (:email, :phone, :passwordHash, :displayName)
                RETURNING id
                """)
            .param("email", email)
            .param("phone", phone)
            .param("passwordHash", passwordHash)
            .param("displayName", displayName)
            .query(UUID.class)
            .single();
    }
}
