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

    /**
     * Saves the name and, when {@code giveConsent}, records the consent (T-5). COALESCE keeps the
     * first consent time and text: a repeated or parallel consent never moves them, and nothing in
     * this statement can clear them (INV-09). The name is set in the same statement, so the
     * {@code CHECK (consent_given_at IS NULL OR name IS NOT NULL)} holds.
     */
    Optional<BrandProfile> updateNameAndConsent(UUID brandId, String name, boolean giveConsent, String consentText) {
        return jdbc.sql("""
                UPDATE brand_profiles SET
                    name = :name,
                    consent_given_at = CASE WHEN :give THEN COALESCE(consent_given_at, now())
                                            ELSE consent_given_at END,
                    consent_text = CASE WHEN :give THEN COALESCE(consent_text, :consentText)
                                        ELSE consent_text END,
                    updated_at = now()
                WHERE brand_id = :brandId
                RETURNING\s""" + COLUMNS)
            .param("name", name)
            .param("give", giveConsent)
            .param("consentText", consentText)
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
