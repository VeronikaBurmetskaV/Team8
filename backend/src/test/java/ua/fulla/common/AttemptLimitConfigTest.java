package ua.fulla.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;

/**
 * The configured login/register limit per profile (ADR-0006). The files are read directly:
 * the tests themselves run with the override from src/test/resources/config/application.yml.
 */
class AttemptLimitConfigTest {

    static final String PROPERTY = "fulla.auth.max-attempts-per-minute";

    @Test
    void defaultLimitIsTenPerMinute() throws IOException {
        assertThat(limitIn("application.yml")).isEqualTo(10);
    }

    /** In dev every visitor comes from 127.0.0.1 (the Vite proxy), so 10 would be shared by all. */
    @Test
    void devProfileRaisesTheLimitForTheLocalDemo() throws IOException {
        assertThat(limitIn("application-dev.yml")).isEqualTo(1000);
    }

    private static Object limitIn(String file) throws IOException {
        List<PropertySource<?>> sources = new YamlPropertySourceLoader().load(file, new ClassPathResource(file));
        assertThat(sources).as(file).hasSize(1);
        return sources.get(0).getProperty(PROPERTY);
    }
}
