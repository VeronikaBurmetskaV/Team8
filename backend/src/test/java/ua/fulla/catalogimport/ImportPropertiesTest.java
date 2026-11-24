package ua.fulla.catalogimport;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource;

/** {@code fulla.import.min-run-interval}: read from the settings, 6 h by default, never below 10 min. */
class ImportPropertiesTest {

    /** Binds the properties the way Spring does for application-*.yml. */
    private static ImportProperties bind(Map<String, String> settings) {
        return new Binder(new MapConfigurationPropertySource(settings))
            .bindOrCreate("fulla.import", ImportProperties.class);
    }

    @Test
    void runIntervalIsReadFromTheSettings() {
        ImportProperties properties = bind(Map.of("fulla.import.min-run-interval", "1h"));

        assertThat(properties.minRunInterval()).isEqualTo(Duration.ofHours(1));
    }

    @Test
    void runIntervalIsSixHoursWhenNotSet() {
        ImportProperties properties = bind(Map.of("fulla.import.enabled", "true"));

        assertThat(properties.minRunInterval()).isEqualTo(Duration.ofHours(6));
    }

    @Test
    void runIntervalBelowTenMinutesIsRaisedToTenMinutes() {
        ImportProperties properties = bind(Map.of("fulla.import.min-run-interval", "5m"));

        assertThat(properties.minRunInterval()).isEqualTo(Duration.ofMinutes(10));
    }

    @Test
    void runIntervalOfExactlyTenMinutesIsKept() {
        ImportProperties properties = bind(Map.of("fulla.import.min-run-interval", "10m"));

        assertThat(properties.minRunInterval()).isEqualTo(Duration.ofMinutes(10));
    }
}
