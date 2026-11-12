package ua.fulla.images;

import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ua.fulla.common.Timestamps;

/** {@link ImageStore} on the {@code images} table: {@code byte[]} ↔ {@code bytea} (ADR-0004, ADR-0007). */
@Repository
class PostgresImageStore implements ImageStore {

    private final JdbcClient jdbc;

    PostgresImageStore(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public UUID save(UUID uploadedBy, String contentType, byte[] bytes) {
        return jdbc.sql("""
                INSERT INTO images (uploaded_by, content_type, size_bytes, bytes)
                VALUES (:uploadedBy, :contentType, :sizeBytes, :bytes)
                RETURNING id
                """)
            .param("uploadedBy", uploadedBy)
            .param("contentType", contentType)
            .param("sizeBytes", bytes.length)
            .param("bytes", bytes)
            .query(UUID.class)
            .single();
    }

    @Override
    public Optional<StoredImage> get(UUID id) {
        return jdbc.sql("SELECT id, uploaded_by, content_type, size_bytes, bytes, created_at FROM images WHERE id = :id")
            .param("id", id)
            .query((rs, rowNum) -> new StoredImage(
                rs.getObject("id", UUID.class),
                rs.getObject("uploaded_by", UUID.class),
                rs.getString("content_type"),
                rs.getInt("size_bytes"),
                rs.getBytes("bytes"),
                Timestamps.instant(rs, "created_at")))
            .optional();
    }

    @Override
    public boolean isOwnedBy(UUID id, UUID brandId) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM images WHERE id = :id AND uploaded_by = :brandId)")
            .param("id", id)
            .param("brandId", brandId)
            .query(Boolean.class)
            .single();
    }
}
