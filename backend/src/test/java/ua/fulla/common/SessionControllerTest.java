package ua.fulla.common;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;

/** GET /api/session (api.md §2.2). */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class SessionControllerTest {

    @Autowired
    MockMvc mvc;

    @Test
    void anonymousSessionHasNulls() throws Exception {
        // The XSRF-TOKEN cookie is checked in BrandAuthHttpTest: spring-security-test swaps the
        // cookie token repository for its own inside MockMvc, so the cookie is not visible here.
        mvc.perform(get("/api/session"))
            .andExpect(status().isOk())
            .andExpect(content().json("{\"accountType\":null,\"email\":null}", true));
    }

    @Test
    void unsupportedAcceptHeaderIsValidationFailedInTheEnvelope() throws Exception {
        mvc.perform(get("/api/session").accept(MediaType.TEXT_PLAIN))
            .andExpect(status().isBadRequest())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(content().json(
                "{\"error\":{\"code\":\"VALIDATION_FAILED\",\"message\":\"Malformed or invalid request\"}}", true));
    }

    @Test
    void brandSessionReportsAccountTypeAndEmail() throws Exception {
        String email = "brand-" + UUID.randomUUID() + "@example.com";
        MockHttpSession session = (MockHttpSession) mvc.perform(post("/api/brand/register").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"secret-123\"}"))
            .andExpect(status().isCreated())
            .andReturn().getRequest().getSession(false);

        mvc.perform(get("/api/session").session(session))
            .andExpect(status().isOk())
            .andExpect(content().json("{\"accountType\":\"BRAND\",\"email\":\"" + email + "\"}", true));

        mvc.perform(post("/api/brand/logout").with(csrf()).session(session))
            .andExpect(status().isNoContent());
        mvc.perform(get("/api/session").session(session))
            .andExpect(status().isOk())
            .andExpect(content().json("{\"accountType\":null,\"email\":null}", true));
    }
}
