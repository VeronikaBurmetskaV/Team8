package ua.fulla.catalogimport;

import java.time.Duration;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** SQL for {@code catalog_sources} and {@code source_brands} (data-model.md §5.1, §5.2). */
@Repository
class CatalogSourceRepository {

    private final JdbcClient jdbc;

    CatalogSourceRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Inserted on first start, not by the migration; an existing row is kept as it is. */
    UUID registerSource(String code, String baseUrl) {
        jdbc.sql("INSERT INTO catalog_sources (code, base_url) VALUES (:code, :baseUrl) ON CONFLICT (code) DO NOTHING")
            .param("code", code)
            .param("baseUrl", baseUrl)
            .update();
        return jdbc.sql("SELECT id FROM catalog_sources WHERE code = :code")
            .param("code", code)
            .query(UUID.class)
            .single();
    }

    /**
     * T-18: at most one run per source per {@code minInterval}, also across restarts. A
     * conditional update, not check-then-act: of two parallel claims only one gets the row.
     * The interval is bound as whole seconds (PostgreSQL JDBC has no {@code Duration} type).
     */
    boolean claimRun(String code, Duration minInterval) {
        return jdbc.sql("""
                UPDATE catalog_sources SET last_run_at = now()
                WHERE code = :code
                  AND (last_run_at IS NULL OR last_run_at < now() - :intervalSeconds * interval '1 second')
                """)
            .param("code", code)
            .param("intervalSeconds", minInterval.toSeconds())
            .update() == 1;
    }

    void finishRun(String code, RunStatus status) {
        jdbc.sql("UPDATE catalog_sources SET last_run_status = :status WHERE code = :code")
            .param("status", status.column())
            .param("code", code)
            .update();
    }

    /** The ID of the account-less brand with this name in this source; created on first use. */
    UUID sourceBrandId(UUID sourceId, String name) {
        jdbc.sql("""
                INSERT INTO source_brands (source_id, name) VALUES (:sourceId, :name)
                ON CONFLICT (source_id, name) DO NOTHING
                """)
            .param("sourceId", sourceId)
            .param("name", name)
            .update();
        return jdbc.sql("SELECT id FROM source_brands WHERE source_id = :sourceId AND name = :name")
            .param("sourceId", sourceId)
            .param("name", name)
            .query(UUID.class)
            .single();
    }
}
