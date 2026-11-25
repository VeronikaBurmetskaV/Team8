package ua.fulla.catalogimport;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ua.fulla.common.Timestamps;

/** SQL for {@code brand_imports} (ADR-0017). The brand ID always comes from the session or the scheduler. */
@Repository
class BrandImportRepository {

    private final JdbcClient jdbc;

    BrandImportRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    Optional<BrandImportState> find(UUID brandId) {
        return jdbc.sql("SELECT * FROM brand_imports WHERE brand_id = :brandId")
            .param("brandId", brandId)
            .query(BrandImportRepository::mapRow)
            .optional();
    }

    /**
     * Starts a run, at most one per {@code minInterval} and never next to a running one (a run
     * older than {@code staleAfter} counts as interrupted). A conditional {@code UPDATE}, as in
     * ADR-0009: of two parallel requests only one gets the row. False = not started.
     */
    boolean claim(UUID brandId, Duration minInterval, Duration staleAfter) {
        jdbc.sql("INSERT INTO brand_imports (brand_id) VALUES (:brandId) ON CONFLICT (brand_id) DO NOTHING")
            .param("brandId", brandId)
            .update();
        return jdbc.sql("""
                UPDATE brand_imports SET status = 'running', started_at = now(), finished_at = NULL, method = NULL,
                    found_count = 0, created_count = 0, updated_count = 0, skipped_count = 0, hidden_count = 0,
                    error_code = NULL, updated_at = now()
                WHERE brand_id = :brandId
                  AND (started_at IS NULL OR started_at < now() - :minSeconds * interval '1 second')
                  AND (status <> 'running' OR started_at < now() - :staleSeconds * interval '1 second')
                """)
            .param("brandId", brandId)
            .param("minSeconds", minInterval.toSeconds())
            .param("staleSeconds", staleAfter.toSeconds())
            .update() == 1;
    }

    void finish(UUID brandId, boolean done, String method, BrandImportState.Counts counts, String errorCode) {
        jdbc.sql("""
                UPDATE brand_imports SET status = :status, method = CAST(:method AS varchar), finished_at = now(),
                    last_success_at = CASE WHEN :done THEN now() ELSE last_success_at END,
                    found_count = :found, created_count = :created, updated_count = :updated,
                    skipped_count = :skipped, hidden_count = :hidden,
                    error_code = CAST(:errorCode AS varchar), updated_at = now()
                WHERE brand_id = :brandId
                """)
            .param("status", done ? "done" : "failed")
            .param("done", done)
            .param("method", method)
            .param("found", counts.found())
            .param("created", counts.created())
            .param("updated", counts.updated())
            .param("skipped", counts.skipped())
            .param("hidden", counts.hidden())
            .param("errorCode", errorCode)
            .param("brandId", brandId)
            .update();
    }

    /**
     * The logo of the brand's site found by the last successful import (ADR-0015); null when
     * none was found. The row exists: every import claims it first.
     */
    void saveSiteLogo(UUID brandId, String siteLogoUrl) {
        jdbc.sql("UPDATE brand_imports SET site_logo_url = CAST(:url AS varchar) WHERE brand_id = :brandId")
            .param("url", siteLogoUrl)
            .param("brandId", brandId)
            .update();
    }

    /** After a restart nothing is running any more. */
    int failInterrupted(String errorCode) {
        return jdbc.sql("""
                UPDATE brand_imports SET status = 'failed', error_code = :errorCode, finished_at = now(),
                    updated_at = now()
                WHERE status = 'running'
                """)
            .param("errorCode", errorCode)
            .update();
    }

    /**
     * The daily refresh: brands whose site is verified ({@code verifiedOnly}; in demo mode any
     * brand with a website), that have at
     * least one imported card, and whose last run started more than {@code interval} ago.
     */
    List<UUID> dueForRefresh(Duration interval, int limit, boolean verifiedOnly) {
        return jdbc.sql("""
                SELECT bi.brand_id
                FROM brand_imports bi
                JOIN brand_profiles bp ON bp.brand_id = bi.brand_id
                WHERE (NOT :verifiedOnly OR bp.site_verified_at IS NOT NULL)
                  AND bp.website_url IS NOT NULL
                  AND bi.status <> 'running'
                  AND (bi.started_at IS NULL OR bi.started_at < now() - :seconds * interval '1 second')
                  AND EXISTS (SELECT 1 FROM products p WHERE p.brand_id = bi.brand_id AND p.external_id IS NOT NULL)
                ORDER BY bi.started_at NULLS FIRST
                LIMIT :limit
                """)
            .param("verifiedOnly", verifiedOnly)
            .param("seconds", interval.toSeconds())
            .param("limit", limit)
            .query(UUID.class)
            .list();
    }

    private static BrandImportState mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new BrandImportState(
            rs.getObject("brand_id", UUID.class),
            rs.getString("status"),
            rs.getString("method"),
            Timestamps.instant(rs, "started_at"),
            Timestamps.instant(rs, "finished_at"),
            Timestamps.instant(rs, "last_success_at"),
            rs.getInt("found_count"),
            rs.getInt("created_count"),
            rs.getInt("updated_count"),
            rs.getInt("skipped_count"),
            rs.getInt("hidden_count"),
            rs.getString("error_code"));
    }
}
