package ua.fulla.common;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.simple.JdbcClient;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class SchemaMigrationTest {

    @Autowired
    JdbcClient jdbc;

    @Test
    void flywayCreatesTheDocumentedTables() {
        List<String> tables = jdbc.sql("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name <> 'flyway_schema_history'
                """)
            .query(String.class)
            .list();

        assertThat(tables).containsExactlyInAnyOrder(
            "brand_accounts", "brand_profiles", "products", "images", "buyer_accounts", "favorites");
    }
}
