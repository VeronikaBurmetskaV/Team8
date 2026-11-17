package ua.fulla.products;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.json.JsonMapper;
import ua.fulla.common.Timestamps;

/**
 * SQL for {@code products}. Every brand query is filtered by the brand ID from the session (T-7);
 * the brand name is always joined from {@code brand_profiles} (INV-03). Imported cards
 * ({@code brand_id IS NULL}, ADR-0014) are only written by the two import methods, so brand
 * queries never see them (T-17).
 */
@Repository
class ProductRepository {

    private static final String SELECT_CARD = """
        SELECT p.id, p.brand_id, p.name, bp.name AS brand_name, p.price_uah, p.photo_image_id, p.photo_url,
               p.product_url, p.status, p.published_at, p.created_at, p.updated_at
        FROM products p
        JOIN brand_profiles bp ON bp.brand_id = p.brand_id
        """;

    private static final JsonMapper JSON = JsonMapper.builder().build();

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

    /**
     * T-15: one statement per imported item. The conflict target only matches rows with a
     * {@code source_id}, so brand cards are never touched. An available item is Published and an
     * existing card keeps its {@code published_at} (feed position); an unavailable one goes to Draft.
     */
    UUID upsertImported(ImportedCard card) {
        return jdbc.sql("""
                INSERT INTO products (source_id, source_brand_id, external_id, last_synced_at, name, price_uah,
                                      photo_url, product_url, sizes, colors, material, description,
                                      status, published_at)
                VALUES (:sourceId, :sourceBrandId, :externalId, now(), :name, :priceUah,
                        :photoUrl, :productUrl, CAST(:sizes AS jsonb), CAST(:colors AS jsonb),
                        CAST(:material AS varchar), CAST(:description AS text),
                        CAST(:status AS varchar), CASE WHEN CAST(:status AS varchar) = 'published' THEN now() END)
                ON CONFLICT (source_id, external_id) DO UPDATE SET
                    source_brand_id = EXCLUDED.source_brand_id,
                    name = EXCLUDED.name,
                    price_uah = EXCLUDED.price_uah,
                    photo_url = EXCLUDED.photo_url,
                    product_url = EXCLUDED.product_url,
                    sizes = EXCLUDED.sizes,
                    colors = EXCLUDED.colors,
                    material = EXCLUDED.material,
                    description = EXCLUDED.description,
                    last_synced_at = now(),
                    updated_at = now(),
                    status = EXCLUDED.status,
                    published_at = CASE WHEN EXCLUDED.status = 'published'
                                        THEN COALESCE(products.published_at, now()) END
                RETURNING id
                """)
            .param("sourceId", card.sourceId())
            .param("sourceBrandId", card.sourceBrandId())
            .param("externalId", card.externalId())
            .param("name", card.name())
            .param("priceUah", card.priceUah())
            .param("photoUrl", card.photoUrl())
            .param("productUrl", card.productUrl())
            .param("sizes", toJson(card.sizes()))
            .param("colors", toJson(card.colors()))
            .param("material", card.material())
            .param("description", card.description())
            .param("status", card.available() ? "published" : "draft")
            .query(UUID.class)
            .single();
    }

    /**
     * T-16: imported cards of the source that were not in a complete run go to Draft; nothing
     * is deleted. Returns the number of hidden cards.
     */
    int unpublishMissingImported(UUID sourceId, Collection<String> seenExternalIds) {
        if (seenExternalIds.isEmpty()) {
            return jdbc.sql("""
                    UPDATE products SET status = 'draft', published_at = NULL, updated_at = now()
                    WHERE source_id = :sourceId AND status = 'published'
                    """)
                .param("sourceId", sourceId)
                .update();
        }
        return jdbc.sql("""
                UPDATE products SET status = 'draft', published_at = NULL, updated_at = now()
                WHERE source_id = :sourceId AND status = 'published' AND external_id NOT IN (:seen)
                """)
            .param("sourceId", sourceId)
            .param("seen", List.copyOf(seenExternalIds))
            .update();
    }

    /** An empty list is stored as NULL, so the feed simply has no block for it. */
    private static String toJson(List<?> values) {
        return values == null || values.isEmpty() ? null : JSON.writeValueAsString(values);
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
