package ua.fulla.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.ServerSocket;
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

    /** final-review №5: a leftover postgres.exe on the port stops the start with a clear message. */
    @Test
    void busyPortFailsWithAClearMessage() throws Exception {
        try (ServerSocket leftover = new ServerSocket(0)) {
            int port = leftover.getLocalPort();

            assertThatThrownBy(() -> DevDatabaseConfig.requireFreePort(port))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Порт " + port + " зайнятий — зупиніть старий postgres.exe (Диспетчер завдань)");
        }
    }

    @Test
    void freePortPassesAndStaysFree() throws Exception {
        int port;
        try (ServerSocket free = new ServerSocket(0)) {
            port = free.getLocalPort();
        }

        assertThatCode(() -> DevDatabaseConfig.requireFreePort(port)).doesNotThrowAnyException();
        // the probe released the port again, so Postgres can bind it
        try (ServerSocket again = new ServerSocket(port)) {
            assertThat(again.isBound()).isTrue();
        }
    }
}
