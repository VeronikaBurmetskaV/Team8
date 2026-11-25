package ua.fulla.buyer;

import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** SQL for {@code favorites} (data-model.md, T-11). Every query is for one buyer from the session. */
@Repository
class FavoritesRepository {

    private final JdbcClient jdbc;

    FavoritesRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Locks the buyer's account row until the end of the transaction, so two parallel writes of
     * the same buyer run one after the other and cannot pass the limit together (ADR-0009).
     */
    void lockBuyer(UUID buyerId) {
        jdbc.sql("SELECT id FROM buyer_accounts WHERE id = :buyer FOR UPDATE")
            .param("buyer", buyerId)
            .query(UUID.class)
            .optional();
    }

    /** The buyer's favourites, oldest like first. */
    List<UUID> list(UUID buyerId) {
        return jdbc.sql("""
                SELECT product_id FROM favorites
                WHERE buyer_id = :buyer
                ORDER BY created_at, product_id
                """)
            .param("buyer", buyerId)
            .query(UUID.class)
            .list();
    }

    /** Which of these IDs are products at all; unknown IDs are ignored (T-11). */
    List<UUID> existingProducts(List<UUID> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return jdbc.sql("SELECT id FROM products WHERE id = ANY(:ids)")
            .param("ids", ids.toArray(new UUID[0]))
            .query(UUID.class)
            .list();
    }

    /**
     * Adds the IDs in the given order: {@code clock_timestamp()} grows row by row, so «oldest like
     * first» keeps the request order. ON CONFLICT DO NOTHING keeps the call idempotent (T-11).
     */
    void insert(UUID buyerId, List<UUID> productIds) {
        if (productIds.isEmpty()) {
            return;
        }
        jdbc.sql("""
                INSERT INTO favorites (buyer_id, product_id, created_at)
                SELECT :buyer, x.id, clock_timestamp()
                FROM unnest(:ids) WITH ORDINALITY AS x(id, n)
                ORDER BY x.n
                ON CONFLICT DO NOTHING
                """)
            .param("buyer", buyerId)
            .param("ids", productIds.toArray(new UUID[0]))
            .update();
    }
}
