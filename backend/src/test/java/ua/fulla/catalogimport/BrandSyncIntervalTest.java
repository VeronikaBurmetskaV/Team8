package ua.fulla.catalogimport;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;
import java.util.Properties;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.core.io.ClassPathResource;

/** {@code fulla.brand-import.sync-interval} (ADR-0017): 24 h by default, 1 h in dev, never below 1 h. */
class BrandSyncIntervalTest {

    @Test
    void defaultIs24HoursAndDevIsOneHour() {
        assertThat(yaml("application.yml").getProperty("fulla.brand-import.sync-interval")).isEqualTo("24h");
        assertThat(yaml("application-dev.yml").getProperty("fulla.brand-import.sync-interval")).isEqualTo("1h");
    }

    @Test
    void syncIsNeverMoreOftenThanOncePerHour() {
        assertThat(properties(null).syncEvery()).isEqualTo(Duration.ofDays(1));
        assertThat(properties(Duration.ofHours(1)).syncEvery()).isEqualTo(Duration.ofHours(1));
        assertThat(properties(Duration.ofMinutes(5)).syncEvery()).isEqualTo(Duration.ofHours(1));
    }

    private static Properties yaml(String file) {
        YamlPropertiesFactoryBean factory = new YamlPropertiesFactoryBean();
        factory.setResources(new ClassPathResource(file));
        return factory.getObject();
    }

    private static BrandImportProperties properties(Duration syncInterval) {
        return new BrandImportProperties(null, Duration.ofSeconds(2), 50, 100, Duration.ofMinutes(10), true,
            syncInterval, true, List.of(), Duration.ZERO, true);
    }
}
