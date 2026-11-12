package ua.fulla.brandauth;

import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ua.fulla.common.Timestamps;

/** SQL for {@code brand_accounts}. The email must already be normalized by the service (T-10). */
@Repository
class BrandAccountRepository {

    private final JdbcClient jdbc;

    BrandAccountRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Inserts the account and returns its ID. A taken email fails on the UNIQUE index
     * with DuplicateKeyException; there is no check before the insert (NFR-04).
     */
    UUID insert(String email, String passwordHash) {
        return jdbc.sql("INSERT INTO brand_accounts (email, password_hash) VALUES (:email, :passwordHash) RETURNING id")
            .param("email", email)
            .param("passwordHash", passwordHash)
            .query(UUID.class)
            .single();
    }

    Optional<BrandAccount> findByEmail(String email) {
        return jdbc.sql("SELECT id, email, password_hash, created_at FROM brand_accounts WHERE email = :email")
            .param("email", email)
            .query((rs, rowNum) -> new BrandAccount(
                rs.getObject("id", UUID.class),
                rs.getString("email"),
                rs.getString("password_hash"),
                Timestamps.instant(rs, "created_at")))
            .optional();
    }
}
