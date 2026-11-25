package ua.fulla.feed;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Public reads for {@code GET /api/brands}: the owners of Published cards (INV-01) with their
 * card counts. Like the feed, it reads the brand profile or the source brand (data-model §5.3).
 */
@Repository
class BrandListRepository {

    /** One owner of Published cards, before the service decides what may be shown. */
    record BrandRow(
            String name,
            int productCount,
            boolean imported,
            boolean consented,
            UUID logoImageId,
            String logoUrl,
            boolean singleBrandSource,
            String sourceLogoUrl,
            /** A registered brand: the logo of its own site, found by its site import (ADR-0017). */
            String siteLogoUrl) {}

    private final JdbcClient jdbc;

    BrandListRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Registered brands and source brands that have at least one Published card. For a source
     * brand, {@code single_brand_source} says whether its source has no other brand (One By One,
     * Cher'17): only then is the source site's logo the brand's logo (not for a marketplace).
     */
    List<BrandRow> listWithPublishedCards() {
        return jdbc.sql("""
                SELECT bp.name, count(*) AS product_count, false AS imported,
                       bp.consent_given_at IS NOT NULL AS consented,
                       bp.logo_image_id, bp.logo_url,
                       false AS single_brand_source, NULL AS source_logo_url,
                       bi.site_logo_url
                FROM products p
                JOIN brand_profiles bp ON bp.brand_id = p.brand_id
                LEFT JOIN brand_imports bi ON bi.brand_id = bp.brand_id
                WHERE p.status = 'published'
                GROUP BY bp.brand_id, bp.name, bp.consent_given_at, bp.logo_image_id, bp.logo_url,
                         bi.site_logo_url
                UNION ALL
                SELECT sb.name, count(*), true, false, NULL, NULL,
                       (SELECT count(*) FROM source_brands other WHERE other.source_id = sb.source_id) = 1,
                       cs.logo_url, NULL
                FROM products p
                JOIN source_brands sb ON sb.id = p.source_brand_id
                JOIN catalog_sources cs ON cs.id = sb.source_id
                WHERE p.status = 'published'
                GROUP BY sb.id, sb.name, sb.source_id, cs.logo_url
                """)
            .query(BrandListRepository::mapRow)
            .list();
    }

    private static BrandRow mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new BrandRow(
            rs.getString("name"),
            rs.getInt("product_count"),
            rs.getBoolean("imported"),
            rs.getBoolean("consented"),
            rs.getObject("logo_image_id", UUID.class),
            rs.getString("logo_url"),
            rs.getBoolean("single_brand_source"),
            rs.getString("source_logo_url"),
            rs.getString("site_logo_url"));
    }
}
