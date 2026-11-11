package ua.fulla.common;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import javax.sql.DataSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * Profile dev: an embedded Postgres with data kept in backend/.data/pg (ADR-0004).
 * Delete backend/.data to reset the database.
 */
@Configuration
@Profile("dev")
public class DevDatabaseConfig {

    static final int PORT = 54329;
    static final Path DATA_DIR = Path.of(".data", "pg");

    @Bean(destroyMethod = "close")
    EmbeddedPostgres embeddedPostgres() throws IOException {
        Files.createDirectories(DATA_DIR);
        return EmbeddedPostgres.builder()
            .setDataDirectory(DATA_DIR)
            .setCleanDataDirectory(false)
            .setPort(PORT)
            .start();
    }

    @Bean
    DataSource dataSource(EmbeddedPostgres postgres) {
        return postgres.getPostgresDatabase();
    }
}
