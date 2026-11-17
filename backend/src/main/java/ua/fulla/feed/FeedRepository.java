package ua.fulla.feed;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/** Public reads of {@code products}: only Published cards (INV-01). */
@Repository
class FeedRepository {

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final TypeReference<List<FeedCard.Size>> SIZES = new TypeReference<>() {};
    private static final TypeReference<List<FeedCard.Color>> COLORS = new TypeReference<>() {};

    private final JdbcClient jdbc;

    FeedRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * All Published cards, brands and sources mixed: round by round, every brand gives its next
     * card ({@code published_at, id} within a brand), so the feed is never a long run of one
     * brand or one import source. Inside a round the brands are ordered by a hash of their ID:
     * stable between requests (the client shows the first card it hasn't seen), but not grouped
     * by source. The brand name is joined, never stored (INV-03): from the brand profile or, for
     * imported cards, from the source brand (data-model.md §5.3).
     */
    List<FeedCard> listPublished() {
        return jdbc.sql("""
                SELECT p.id, p.name, COALESCE(bp.name, sb.name) AS brand_name, p.price_uah,
                       p.photo_image_id, p.photo_url, p.product_url,
                       p.sizes::text AS sizes, p.colors::text AS colors, p.material, p.description
                FROM products p
                LEFT JOIN brand_profiles bp ON bp.brand_id = p.brand_id
                LEFT JOIN source_brands sb ON sb.id = p.source_brand_id
                WHERE p.status = 'published'
                ORDER BY ROW_NUMBER() OVER (PARTITION BY COALESCE(p.brand_id, p.source_brand_id)
                                            ORDER BY p.published_at, p.id),
                         md5(COALESCE(p.brand_id, p.source_brand_id)::text),
                         p.id
                """)
            .query(FeedRepository::mapRow)
            .list();
    }

    private static FeedCard mapRow(ResultSet rs, int rowNum) throws SQLException {
        UUID photoImageId = rs.getObject("photo_image_id", UUID.class);
        // photoUrl is what an <img> loads: the uploaded image or the brand's https:// URL.
        String photoUrl = photoImageId != null ? "/api/images/" + photoImageId : rs.getString("photo_url");
        String sizes = rs.getString("sizes");
        String colors = rs.getString("colors");
        return new FeedCard(
            rs.getObject("id", UUID.class),
            rs.getString("name"),
            rs.getString("brand_name"),
            rs.getInt("price_uah"),
            photoUrl,
            rs.getString("product_url"),
            sizes == null ? null : JSON.readValue(sizes, SIZES),
            colors == null ? null : JSON.readValue(colors, COLORS),
            rs.getString("material"),
            rs.getString("description"));
    }
}
