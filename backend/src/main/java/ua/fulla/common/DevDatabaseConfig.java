package ua.fulla.common;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.io.IOException;
import java.net.ServerSocket;
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

    /**
     * Fixed non-default port (ADR-0004). Kept below the ephemeral port ranges (Linux from 32768,
     * macOS and Windows from 49152), where the OS may hand the port to any other process.
     */
    static final int PORT = 15432;
    static final Path DATA_DIR = Path.of(".data", "pg");

    @Bean(destroyMethod = "close")
    EmbeddedPostgres embeddedPostgres() throws IOException {
        requireFreePort(PORT);
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

    /**
     * Fails the start when something already listens on the port (final-review №5). Otherwise
     * the new Postgres only logs "another postmaster?" and the app silently connects to the
     * leftover one, usually a postgres.exe from an earlier run on Windows.
     */
    static void requireFreePort(int port) {
        try (ServerSocket probe = new ServerSocket(port)) {
            // Free: the probe is closed again before Postgres binds the port.
        } catch (IOException e) {
            throw new IllegalStateException(
                "Порт " + port + " зайнятий — зупиніть старий postgres.exe (Диспетчер завдань)", e);
        }
    }
}
