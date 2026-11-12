package ua.fulla.common;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class DevDatabaseConfigTest {

    /**
     * Ephemeral ports start at 32768 on Linux and at 49152 on macOS and Windows. A port in those
     * ranges can already be taken by any process when the embedded Postgres starts.
     */
    @Test
    void embeddedPostgresPortIsBelowTheEphemeralRanges() {
        assertThat(DevDatabaseConfig.PORT).isEqualTo(15432).isLessThan(32768);
    }
}
