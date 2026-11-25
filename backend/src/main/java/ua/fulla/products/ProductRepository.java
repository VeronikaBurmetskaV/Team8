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
               p.product_url, p.status, p.published_at, p.created_at, p.updated_at, p.source_url,
               array_to_string(p.edited_fields, ',') AS edited_fields, p.missing_since
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

    /**
     * T-1: Draft → Published in one statement, only if the card is the brand's own Draft that its
     * site still lists (not «Немає на сайті», ADR-0017) and the brand has given consent (ADR-0009, no check-then-update). A republish gets a new
     * {@code published_at}, so the card moves to the end of the brand's cards in the feed.
     * Returns the number of changed rows: 1 or 0.
     */
    int publish(UUID id, UUID brandId) {
        return jdbc.sql("""
                UPDATE products SET status = 'published', published_at = now(), updated_at = now()
                WHERE id = :id AND brand_id = :brandId AND status = 'draft' AND missing_since IS NULL
                  AND EXISTS (SELECT 1 FROM brand_profiles
                              WHERE brand_id = :brandId AND consent_given_at IS NOT NULL)
                """)
            .param("id", id)
            .param("brandId", brandId)
            .update();
    }

    /** T-4: Published → Draft in one statement, only for the brand's own Published card. Returns 1 or 0. */
    int unpublish(UUID id, UUID brandId) {
        return jdbc.sql("""
                UPDATE products SET status = 'draft', published_at = NULL, updated_at = now()
                WHERE id = :id AND brand_id = :brandId AND status = 'published'
                """)
            .param("id", id)
            .param("brandId", brandId)
            .update();
    }

    /**
     * T-3: edits the brand's own Draft in one statement; a Published card is not changed
     * (INV-10). For a card imported from the brand's site (ADR-0017) every field whose value
     * changes is added to {@code edited_fields}, so a re-import never overwrites it. {@code old}
     * is the row as it was before this statement. Returns 1 or 0.
     */
    int updateDraft(UUID id, UUID brandId, ProductDraft draft) {
        return jdbc.sql("""
                UPDATE products p SET
                    name = :name,
                    price_uah = :priceUah,
                    photo_image_id = CAST(:photoImageId AS uuid),
                    photo_url = CAST(:photoUrl AS varchar),
                    product_url = :productUrl,
                    updated_at = now(),
                    edited_fields = CASE WHEN old.external_id IS NULL THEN old.edited_fields ELSE ARRAY(
                        SELECT DISTINCT f FROM unnest(old.edited_fields || array_remove(ARRAY[
                            CASE WHEN old.name IS DISTINCT FROM :name THEN 'name' END,
                            CASE WHEN old.price_uah IS DISTINCT FROM :priceUah THEN 'price_uah' END,
                            CASE WHEN old.photo_url IS DISTINCT FROM CAST(:photoUrl AS varchar)
                                   OR old.photo_image_id IS DISTINCT FROM CAST(:photoImageId AS uuid)
                                 THEN 'photo' END,
                            CASE WHEN old.product_url IS DISTINCT FROM :productUrl THEN 'product_url' END
                        ]::text[], NULL)) AS f ORDER BY f) END
                FROM products old
                WHERE p.id = old.id AND p.id = :id AND p.brand_id = :brandId AND p.status = 'draft'
                """)
            .param("id", id)
            .param("brandId", brandId)
            .param("name", draft.name())
            .param("priceUah", draft.priceUah())
            .param("photoImageId", draft.photoImageId())
            .param("photoUrl", draft.photoUrl())
            .param("productUrl", draft.productUrl())
            .update();
    }

    /**
     * T-1 for many cards at once: the brand's own Drafts among {@code ids} are published in one
     * statement, only if the brand has given consent. Returns the IDs that were published.
     */
    List<UUID> publishMany(Collection<UUID> ids, UUID brandId) {
        return jdbc.sql("""
                UPDATE products SET status = 'published', published_at = now(), updated_at = now()
                WHERE id IN (:ids) AND brand_id = :brandId AND status = 'draft' AND missing_since IS NULL
                  AND EXISTS (SELECT 1 FROM brand_profiles
                              WHERE brand_id = :brandId AND consent_given_at IS NOT NULL)
                RETURNING id
                """)
            .param("ids", List.copyOf(ids))
            .param("brandId", brandId)
            .query(UUID.class)
            .list();
    }

    /**
     * T-4 for many cards at once: the brand's own Published cards among {@code ids} go back to
     * Draft in one statement. Returns the IDs that changed; foreign, unknown and Draft cards are
     * not touched.
     */
    List<UUID> unpublishMany(Collection<UUID> ids, UUID brandId) {
        return jdbc.sql("""
                UPDATE products SET status = 'draft', published_at = NULL, updated_at = now()
                WHERE id IN (:ids) AND brand_id = :brandId AND status = 'published'
                RETURNING id
                """)
            .param("ids", List.copyOf(ids))
            .param("brandId", brandId)
            .query(UUID.class)
            .list();
    }

    // ---------- brand site import (ADR-0017) ----------

    /**
     * Updates the brand's imported card of {@code externalId}. Fields in {@code edited_fields}
     * keep the brand's values; sizes, colours, material and description always follow the site.
     * Works on Published cards too (the ADR-0017 exception to INV-10). A card that was «Немає на
     * сайті» is listed again: it becomes an ordinary Draft (not published) and counts as changed.
     * Empty when the brand has no such card; otherwise whether any stored value changed.
     */
    Optional<Boolean> updateBrandImported(BrandImportedCard card) {
        return jdbc.sql("""
                UPDATE products p SET
                    name = CASE WHEN 'name' = ANY(old.edited_fields) THEN old.name ELSE :name END,
                    price_uah = CASE WHEN 'price_uah' = ANY(old.edited_fields) THEN old.price_uah ELSE :priceUah END,
                    photo_url = CASE WHEN 'photo' = ANY(old.edited_fields) THEN old.photo_url ELSE :photoUrl END,
                    photo_image_id = CASE WHEN 'photo' = ANY(old.edited_fields) THEN old.photo_image_id END,
                    product_url = CASE WHEN 'product_url' = ANY(old.edited_fields) THEN old.product_url
                                       ELSE :productUrl END,
                    sizes = CAST(:sizes AS jsonb),
                    colors = CAST(:colors AS jsonb),
                    material = CAST(:material AS varchar),
                    description = CAST(:description AS text),
                    source_url = :sourceUrl,
                    last_synced_at = now(),
                    -- listed again: an ordinary Draft (never published automatically), back in the list
                    missing_since = NULL,
                    removed_from_list_at = NULL,
                    updated_at = now()
                FROM products old
                WHERE p.id = old.id AND p.brand_id = :brandId AND p.external_id = :externalId
                RETURNING (p.name, p.price_uah, p.photo_url, p.product_url, p.sizes, p.colors, p.material,
                           p.description)
                          IS DISTINCT FROM
                          (old.name, old.price_uah, old.photo_url, old.product_url, old.sizes, old.colors,
                           old.material, old.description)
                          OR old.missing_since IS NOT NULL AS changed
                """)
            .param("brandId", card.brandId())
            .param("externalId", card.externalId())
            .param("name", card.name())
            .param("priceUah", card.priceUah())
            .param("photoUrl", card.photoUrl())
            .param("productUrl", card.productUrl())
            .param("sizes", toJson(card.sizes()))
            .param("colors", toJson(card.colors()))
            .param("material", card.material())
            .param("description", card.description())
            .param("sourceUrl", card.sourceUrl())
            .query(Boolean.class)
            .optional();
    }

    /**
     * A new Draft from the brand's site. T-2 in the same statement: only when the brand name is
     * saved. Empty when the name is missing or the card already exists (a parallel import).
     */
    Optional<UUID> insertBrandImported(BrandImportedCard card) {
        return jdbc.sql("""
                INSERT INTO products (brand_id, external_id, source_url, last_synced_at, name, price_uah, photo_url,
                                      product_url, sizes, colors, material, description, status)
                SELECT brand_id, :externalId, :sourceUrl, now(), :name, :priceUah, :photoUrl,
                       :productUrl, CAST(:sizes AS jsonb), CAST(:colors AS jsonb), CAST(:material AS varchar),
                       CAST(:description AS text), 'draft'
                FROM brand_profiles
                WHERE brand_id = :brandId AND name IS NOT NULL
                ON CONFLICT (brand_id, external_id) DO NOTHING
                RETURNING id
                """)
            .param("brandId", card.brandId())
            .param("externalId", card.externalId())
            .param("sourceUrl", card.sourceUrl())
            .param("name", card.name())
            .param("priceUah", card.priceUah())
            .param("photoUrl", card.photoUrl())
            .param("productUrl", card.productUrl())
            .param("sizes", toJson(card.sizes()))
            .param("colors", toJson(card.colors()))
            .param("material", card.material())
            .param("description", card.description())
            .query(UUID.class)
            .optional();
    }

    /** Published imported cards of the brand among {@code externalIds} go to Draft. Returns how many. */
    int hideBrandImported(UUID brandId, Collection<String> externalIds) {
        if (externalIds.isEmpty()) {
            return 0;
        }
        return jdbc.sql("""
                UPDATE products SET status = 'draft', published_at = NULL, updated_at = now()
                WHERE brand_id = :brandId AND status = 'published' AND external_id IN (:ids)
                """)
            .param("brandId", brandId)
            .param("ids", List.copyOf(externalIds))
            .update();
    }

    /**
     * After a complete listing of the site (ADR-0017): the brand's imported cards that the site
     * no longer lists become «Немає на сайті» ({@code missing_since}) in one statement; a
     * Published one goes to Draft at the same time, so it leaves the feed. Never deletes;
     * hand-made cards ({@code external_id IS NULL}) are never touched. An empty listing marks
     * nothing. Returns how many of the marked cards were Published.
     */
    int markMissingBrandImported(UUID brandId, Collection<String> listedExternalIds) {
        if (listedExternalIds.isEmpty()) {
            return 0;
        }
        return (int) jdbc.sql("""
                UPDATE products p SET status = 'draft', published_at = NULL, missing_since = now(),
                    updated_at = now()
                FROM products old
                WHERE p.id = old.id AND p.brand_id = :brandId AND p.external_id IS NOT NULL
                  AND p.missing_since IS NULL AND p.external_id NOT IN (:listed)
                RETURNING old.status = 'published' AS was_published
                """)
            .param("brandId", brandId)
            .param("listed", List.copyOf(listedExternalIds))
            .query(Boolean.class)
            .list().stream().filter(Boolean.TRUE::equals).count();
    }

    /**
     * «Прибрати зі списку»: hides a «Немає на сайті» card from the cabinet list. Only the brand's
     * own missing card; the row stays (no deletion). Returns 1, or 0 when nothing changed.
     */
    int removeFromList(UUID id, UUID brandId) {
        return jdbc.sql("""
                UPDATE products SET removed_from_list_at = now(), updated_at = now()
                WHERE id = :id AND brand_id = :brandId AND missing_since IS NOT NULL
                  AND removed_from_list_at IS NULL
                """)
            .param("id", id)
            .param("brandId", brandId)
            .update();
    }

    /**
     * The cabinet list (US-25.1 S1, US-21.1 S1): newest first, «Немає на сайті» cards at the end
     * (ADR-0017). Left out: cards removed from the list by the brand and cards missing for longer
     * than {@code keepMissing}; they stay in the table.
     */
    List<ProductCard> listOwn(UUID brandId, java.time.Duration keepMissing) {
        return jdbc.sql(SELECT_CARD + """
                WHERE p.brand_id = :brandId AND p.removed_from_list_at IS NULL
                  AND (p.missing_since IS NULL OR p.missing_since > now() - :keepSeconds * interval '1 second')
                ORDER BY (p.missing_since IS NOT NULL), p.created_at DESC, p.id DESC
                """)
            .param("brandId", brandId)
            .param("keepSeconds", keepMissing.toSeconds())
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
            Timestamps.instant(rs, "updated_at"),
            rs.getString("source_url"),
            editedFields(rs.getString("edited_fields")),
            Timestamps.instant(rs, "missing_since"));
    }

    private static List<String> editedFields(String joined) {
        return joined == null || joined.isEmpty() ? List.of() : List.of(joined.split(","));
    }
}
