package ua.fulla.brandprofile;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ua.fulla.common.SiteDomain;
import ua.fulla.common.Timestamps;

/** SQL for {@code brand_profiles}. Every query is filtered by the brand ID from the session (T-7). */
@Repository
class BrandProfileRepository {

    private static final String COLUMNS =
        "brand_id, name, logo_image_id, logo_url, website_url, consent_given_at, consent_text, verification_token, "
        + "site_verified_at, site_domain, feed_url, created_at, updated_at";

    private final JdbcClient jdbc;

    BrandProfileRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** The profile row of a new brand, with the name and website from registration (US-21). */
    void insert(UUID brandId, String name, String websiteUrl) {
        jdbc.sql("INSERT INTO brand_profiles (brand_id, name, website_url) VALUES (:brandId, :name, :websiteUrl)")
            .param("brandId", brandId)
            .param("name", name)
            .param("websiteUrl", websiteUrl)
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
    Optional<BrandProfile> updateNameAndConsent(UUID brandId, String name, String websiteUrl, String feedUrl,
            boolean giveConsent, String consentText) {
        // ADR-0017: a website on another domain clears the site verification in the same statement.
        return jdbc.sql("""
                UPDATE brand_profiles SET
                    name = :name,
                    website_url = :websiteUrl,
                    feed_url = CAST(:feedUrl AS varchar),
                    site_verified_at = CASE WHEN site_domain IS NOT DISTINCT FROM CAST(:siteDomain AS varchar)
                                            THEN site_verified_at END,
                    site_domain = CASE WHEN site_domain IS NOT DISTINCT FROM CAST(:siteDomain AS varchar)
                                       THEN site_domain END,
                    consent_given_at = CASE WHEN :give THEN COALESCE(consent_given_at, now())
                                            ELSE consent_given_at END,
                    consent_text = CASE WHEN :give THEN COALESCE(consent_text, :consentText)
                                        ELSE consent_text END,
                    updated_at = now()
                WHERE brand_id = :brandId
                RETURNING\s""" + COLUMNS)
            .param("name", name)
            .param("websiteUrl", websiteUrl)
            .param("feedUrl", feedUrl)
            .param("siteDomain", SiteDomain.of(websiteUrl))
            .param("give", giveConsent)
            .param("consentText", consentText)
            .param("brandId", brandId)
            .query(BrandProfileRepository::mapRow)
            .optional();
    }

    /**
     * ADR-0017: records a successful site verification. Only while the website is still the one
     * that was checked (a parallel profile save may have changed it); the first verification
     * time of a domain is kept. Empty when the website changed meanwhile.
     */
    Optional<BrandProfile> markSiteVerified(UUID brandId, String websiteUrl, String siteDomain) {
        return jdbc.sql("""
                UPDATE brand_profiles SET
                    site_verified_at = CASE WHEN site_domain = :siteDomain THEN site_verified_at ELSE now() END,
                    site_domain = :siteDomain,
                    updated_at = now()
                WHERE brand_id = :brandId AND website_url = :websiteUrl
                RETURNING\s""" + COLUMNS)
            .param("siteDomain", siteDomain)
            .param("brandId", brandId)
            .param("websiteUrl", websiteUrl)
            .query(BrandProfileRepository::mapRow)
            .optional();
    }

    private static BrandProfile mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new BrandProfile(
            rs.getObject("brand_id", UUID.class),
            rs.getString("name"),
            rs.getObject("logo_image_id", UUID.class),
            rs.getString("logo_url"),
            rs.getString("website_url"),
            Timestamps.instant(rs, "consent_given_at"),
            rs.getString("consent_text"),
            rs.getString("verification_token"),
            Timestamps.instant(rs, "site_verified_at"),
            rs.getString("site_domain"),
            rs.getString("feed_url"),
            Timestamps.instant(rs, "created_at"),
            Timestamps.instant(rs, "updated_at"));
    }
}
