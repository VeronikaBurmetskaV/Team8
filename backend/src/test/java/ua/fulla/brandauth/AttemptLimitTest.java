package ua.fulla.brandauth;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * 429 TOO_MANY_REQUESTS on login and register (ADR-0006, api.md §3.2). The other tests run with
 * a very high limit (src/test/resources/config/application.yml); here it is the real one.
 */
@SpringBootTest(properties = "fulla.auth.max-attempts-per-minute=10")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class AttemptLimitTest {

    @Autowired
    MockMvc mvc;

    @Test
    void eleventhLoginWithinAMinuteIsTooManyRequests() throws Exception {
        String body = "{\"email\":\"brand-" + UUID.randomUUID() + "@example.com\",\"password\":\"wrong-password\"}";

        for (int attempt = 1; attempt <= 10; attempt++) {
            attempt("/api/brand/login", "10.1.1.1", body).andExpect(status().isUnauthorized());
        }

        attempt("/api/brand/login", "10.1.1.1", body)
            .andExpect(status().isTooManyRequests())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$.error.code").value("TOO_MANY_REQUESTS"))
            .andExpect(jsonPath("$.error.message").isString())
            .andExpect(jsonPath("$.error.fields").doesNotExist());

        // another address is not affected
        attempt("/api/brand/login", "10.1.1.2", body).andExpect(status().isUnauthorized());
    }

    @Test
    void registerAndLoginShareTheLimitAndARefusedRegistrationCreatesNothing() throws Exception {
        String email = "brand-" + UUID.randomUUID() + "@example.com";
        String body = "{\"email\":\"" + email + "\",\"password\":\"secret-123\"}";

        for (int attempt = 1; attempt <= 10; attempt++) {
            attempt("/api/brand/login", "10.2.2.2", body).andExpect(status().isUnauthorized());
        }

        attempt("/api/brand/register", "10.2.2.2", body)
            .andExpect(status().isTooManyRequests())
            .andExpect(jsonPath("$.error.code").value("TOO_MANY_REQUESTS"));

        // the account was not created: from another address the same email registers normally
        attempt("/api/brand/register", "10.3.3.3", body).andExpect(status().isCreated());
    }

    private ResultActions attempt(String path, String ip, String body) throws Exception {
        return mvc.perform(post(path).with(csrf())
            .with(request -> {
                request.setRemoteAddr(ip);
                return request;
            })
            .contentType(MediaType.APPLICATION_JSON).content(body));
    }
}
