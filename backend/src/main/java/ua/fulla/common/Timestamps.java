package ua.fulla.common;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;

/** Row-mapping helper for {@code timestamptz} columns. */
public final class Timestamps {

    private Timestamps() {}

    /** The Postgres driver reads timestamptz as OffsetDateTime, not Instant. Null stays null. */
    public static Instant instant(ResultSet rs, String column) throws SQLException {
        OffsetDateTime value = rs.getObject(column, OffsetDateTime.class);
        return value == null ? null : value.toInstant();
    }
}
