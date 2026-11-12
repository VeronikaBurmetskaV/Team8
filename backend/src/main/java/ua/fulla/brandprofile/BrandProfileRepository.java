package ua.fulla.brandprofile;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ua.fulla.common.Timestamps;

/** SQL for {@code brand_profiles}. Every query is filtered by the brand ID from the session (T-7). */
@Repository
class BrandProfileRepository {

    private static final String COLUMNS =
        "brand_id, name, logo_image_id, logo_url, consent_given_at, consent_text, created_at, updated_at";

    private final JdbcClient jdbc;

    BrandProfileRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    void insertEmpty(UUID brandId) {
        jdbc.sql("INSERT INTO brand_profiles (brand_id) VALUES (:brandId)")
            .param("brandId", brandId)
            .update();
    }

    Optional<BrandProfile> findByBrandId(UUID brandId) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM brand_profiles WHERE brand_id = :brandId")
            .param("brandId", brandId)
            .query(BrandProfileRepository::mapRow)
            .optional();
    }

    Optional<BrandProfile> updateName(UUID brandId, String name) {
        return jdbc.sql("UPDATE brand_profiles SET name = :name, updated_at = now() "
                + "WHERE brand_id = :brandId RETURNING " + COLUMNS)
            .param("name", name)
            .param("brandId", brandId)
            .query(BrandProfileRepository::mapRow)
            .optional();
    }

    private static BrandProfile mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new BrandProfile(
            rs.getObject("brand_id", UUID.class),
            rs.getString("name"),
            rs.getObject("logo_image_id", UUID.class),
            rs.getString("logo_url"),
            Timestamps.instant(rs, "consent_given_at"),
            rs.getString("consent_text"),
            Timestamps.instant(rs, "created_at"),
            Timestamps.instant(rs, "updated_at"));
    }
}
