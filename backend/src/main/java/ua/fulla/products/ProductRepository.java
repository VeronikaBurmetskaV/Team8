package ua.fulla.products;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ua.fulla.common.Timestamps;

/**
 * SQL for {@code products}. Every query is filtered by the brand ID from the session (T-7);
 * the brand name is always joined from {@code brand_profiles} (INV-03).
 */
@Repository
class ProductRepository {

    private static final String SELECT_CARD = """
        SELECT p.id, p.brand_id, p.name, bp.name AS brand_name, p.price_uah, p.photo_image_id, p.photo_url,
               p.product_url, p.status, p.published_at, p.created_at, p.updated_at
        FROM products p
        JOIN brand_profiles bp ON bp.brand_id = p.brand_id
        """;

    private final JdbcClient jdbc;

    ProductRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * T-2: inserts a draft only if the brand name is saved, in the same statement.
     * Empty when the profile has no name (state Incomplete).
     */
    Optional<UUID> insertDraft(UUID brandId, ProductDraft draft) {
        // The casts give the nullable parameters a type when they are NULL.
        return jdbc.sql("""
                INSERT INTO products (brand_id, name, price_uah, photo_image_id, photo_url, product_url, status)
                SELECT brand_id, :name, :priceUah, CAST(:photoImageId AS uuid), CAST(:photoUrl AS varchar),
                       :productUrl, 'draft'
                FROM brand_profiles
                WHERE brand_id = :brandId AND name IS NOT NULL
                RETURNING id
                """)
            .param("brandId", brandId)
            .param("name", draft.name())
            .param("priceUah", draft.priceUah())
            .param("photoImageId", draft.photoImageId())
            .param("photoUrl", draft.photoUrl())
            .param("productUrl", draft.productUrl())
            .query(UUID.class)
            .optional();
    }

    Optional<ProductCard> findOwn(UUID id, UUID brandId) {
        return jdbc.sql(SELECT_CARD + "WHERE p.id = :id AND p.brand_id = :brandId")
            .param("id", id)
            .param("brandId", brandId)
            .query(ProductRepository::mapRow)
            .optional();
    }

    /** The cabinet list (US-25.1 S1, US-21.1 S1): newest first. */
    List<ProductCard> listOwn(UUID brandId) {
        return jdbc.sql(SELECT_CARD + "WHERE p.brand_id = :brandId ORDER BY p.created_at DESC, p.id DESC")
            .param("brandId", brandId)
            .query(ProductRepository::mapRow)
            .list();
    }

    private static ProductCard mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new ProductCard(
            rs.getObject("id", UUID.class),
            rs.getObject("brand_id", UUID.class),
            rs.getString("name"),
            rs.getString("brand_name"),
            rs.getInt("price_uah"),
            rs.getObject("photo_image_id", UUID.class),
            rs.getString("photo_url"),
            rs.getString("product_url"),
            ProductStatus.fromColumn(rs.getString("status")),
            Timestamps.instant(rs, "published_at"),
            Timestamps.instant(rs, "created_at"),
            Timestamps.instant(rs, "updated_at"));
    }
}
