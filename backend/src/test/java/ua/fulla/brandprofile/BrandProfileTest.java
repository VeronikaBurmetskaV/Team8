package ua.fulla.brandprofile;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import ua.fulla.common.SessionAccount;
import ua.fulla.common.SessionAccount.AccountType;

/** US-22.1, brand name only. */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class BrandProfileTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcClient jdbc;

    @Test
    void newProfileIsIncompleteWithTheDocumentedFields() throws Exception {
        MockHttpSession session = registerBrand(uniqueEmail());

        mvc.perform(get("/api/brand/profile").session(session))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value((Object) null))
            .andExpect(jsonPath("$.logoImageId").value((Object) null))
            .andExpect(jsonPath("$.logoUrl").value((Object) null))
            .andExpect(jsonPath("$.consentGiven").value(false))
            .andExpect(jsonPath("$.logoDisplayUrl").value((Object) null))
            .andExpect(jsonPath("$.consentGivenAt").value((Object) null))
            .andExpect(jsonPath("$.consentText").value((Object) null))
            .andExpect(jsonPath("$.state").value("INCOMPLETE"))
            .andExpect(jsonPath("$.length()").value(8));
    }

    @Test
    void validNameMakesTheProfileActive() throws Exception {
        MockHttpSession session = registerBrand(uniqueEmail());

        putName(session, "\"Lileya\"")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Lileya"))
            .andExpect(jsonPath("$.state").value("ACTIVE"))
            .andExpect(jsonPath("$.consentGiven").value(false))
            .andExpect(jsonPath("$.length()").value(8));

        mvc.perform(get("/api/brand/profile").session(session))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Lileya"))
            .andExpect(jsonPath("$.state").value("ACTIVE"));
    }

    @Test
    void loginAfterSavingTheNameReportsActive() throws Exception {
        String email = uniqueEmail();
        putName(registerBrand(email), "\"Lileya\"").andExpect(status().isOk());

        mvc.perform(post("/api/brand/login").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"secret-123\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.profileState").value("ACTIVE"));
    }

    @Test
    void nameIsTrimmedAndBoundariesAreAccepted() throws Exception {
        MockHttpSession session = registerBrand(uniqueEmail());

        putName(session, "\"  Ля  \"")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Ля"));
        putName(session, "\"" + "я".repeat(50) + "\"")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("я".repeat(50)));
        // non-breaking spaces (U+00A0) are trimmed like ordinary ones
        putName(session, "\"\u00A0Ля\u00A0\"")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Ля"));
    }

    @Test
    void nameOutsideTwoToFiftyCharactersIsRejected() throws Exception {
        MockHttpSession session = registerBrand(uniqueEmail());
        putName(session, "\"Lileya\"").andExpect(status().isOk());

        // The last three: only non-breaking spaces, U+0000 (as a JSON escape), another control character
        List<String> invalid = List.of("\"L\"", "\"" + "x".repeat(51) + "\"", "\"\"", "\"   \"", "\" L \"", "null",
            "\"\u00A0\u00A0\u00A0\"", "\"ab\\u0000cd\"", "\"ab\\u0007cd\"");
        for (String name : invalid) {
            putName(session, name)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$.error.code").value("PROFILE_INVALID"))
                .andExpect(jsonPath("$.error.message").isString())
                .andExpect(jsonPath("$.error.fields.name").value("PROFILE_INVALID"))
                .andExpect(jsonPath("$.error.fields.length()").value(1));
        }

        // a rejected save changes nothing
        mvc.perform(get("/api/brand/profile").session(session))
            .andExpect(jsonPath("$.name").value("Lileya"));
    }

    @Test
    void missingNameFieldIsRejected() throws Exception {
        MockHttpSession session = registerBrand(uniqueEmail());

        mvc.perform(put("/api/brand/profile").with(csrf()).session(session)
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error.code").value("PROFILE_INVALID"))
            .andExpect(jsonPath("$.error.fields.name").value("PROFILE_INVALID"));
    }

    @Test
    void logoUrlMustBeHttps() throws Exception {
        MockHttpSession session = registerBrand(uniqueEmail());

        List<String> invalid = List.of("http://insecure.example/logo.png", "HTTPS://example.com/logo.png",
            "example.com/logo.png", "data:image/png;base64,AAAA", "https://", "");
        for (String logoUrl : invalid) {
            putProfile(session, "{\"name\":\"Lileya\",\"logoImageId\":null,\"logoUrl\":\"" + logoUrl
                    + "\",\"consentGiven\":false}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("PROFILE_INVALID"))
                .andExpect(jsonPath("$.error.fields.logoUrl").value("PROFILE_INVALID"))
                .andExpect(jsonPath("$.error.fields.length()").value(1));
        }

        // nothing was saved, not even the valid name
        mvc.perform(get("/api/brand/profile").session(session))
            .andExpect(jsonPath("$.state").value("INCOMPLETE"));

        putProfile(session, "{\"name\":\"Lileya\",\"logoImageId\":null,"
                + "\"logoUrl\":\"https://cdn.brand-site.ua/logo.png\",\"consentGiven\":false}")
            .andExpect(status().isOk());
    }

    @Test
    void bothLogoSourcesAtOnceAreRejected() throws Exception {
        MockHttpSession session = registerBrand(uniqueEmail());

        putProfile(session, "{\"name\":\"Lileya\",\"logoImageId\":\"" + UUID.randomUUID()
                + "\",\"logoUrl\":\"https://cdn.brand-site.ua/logo.png\",\"consentGiven\":false}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error.code").value("PROFILE_INVALID"))
            .andExpect(jsonPath("$.error.fields.logoImageId").value("PROFILE_INVALID"))
            .andExpect(jsonPath("$.error.fields.logoUrl").value("PROFILE_INVALID"));

        mvc.perform(get("/api/brand/profile").session(session))
            .andExpect(jsonPath("$.state").value("INCOMPLETE"));
    }

    @Test
    void invalidNameAndLogoUrlReportBothFieldsWithNameFirst() throws Exception {
        MockHttpSession session = registerBrand(uniqueEmail());

        putProfile(session, "{\"name\":\"L\",\"logoImageId\":null,\"logoUrl\":\"http://x.ua/l.png\",\"consentGiven\":false}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error.code").value("PROFILE_INVALID"))
            .andExpect(jsonPath("$.error.message").value("name must be 2-50 characters without control characters"))
            .andExpect(jsonPath("$.error.fields.name").value("PROFILE_INVALID"))
            .andExpect(jsonPath("$.error.fields.logoUrl").value("PROFILE_INVALID"));
    }

    @Test
    void wrongContentTypeIsValidationFailedNotServerError() throws Exception {
        MockHttpSession session = registerBrand(uniqueEmail());

        mvc.perform(put("/api/brand/profile").with(csrf()).session(session)
                .contentType(MediaType.TEXT_PLAIN).content("{\"name\":\"Lileya\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"));
    }

    @Test
    void brandChangesOnlyItsOwnProfile() throws Exception {
        String otherEmail = uniqueEmail();
        registerBrand(otherEmail);
        MockHttpSession session = registerBrand(uniqueEmail());

        putName(session, "\"Lileya\"").andExpect(status().isOk());

        String otherName = jdbc.sql("""
                SELECT p.name FROM brand_profiles p
                JOIN brand_accounts a ON a.id = p.brand_id WHERE a.email = :email
                """)
            .param("email", otherEmail).query(String.class).optional().orElse(null);
        assertThat(otherName).isNull();
    }

    @Test
    void profileRequiresABrandSession() throws Exception {
        mvc.perform(get("/api/brand/profile"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error.code").value("UNAUTHENTICATED"));

        mvc.perform(put("/api/brand/profile").with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Lileya\"}"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error.code").value("UNAUTHENTICATED"));
    }

    @Test
    void buyerSessionIsForbidden() throws Exception {
        var buyer = new SessionAccount(AccountType.BUYER, UUID.randomUUID(), "buyer@example.com");
        var authentication = UsernamePasswordAuthenticationToken.authenticated(
            buyer, null, List.of(new SimpleGrantedAuthority("ROLE_BUYER")));

        mvc.perform(get("/api/brand/profile")
                .with(SecurityMockMvcRequestPostProcessors.authentication(authentication)))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
    }

    @Test
    void putWithoutCsrfTokenIsForbidden() throws Exception {
        MockHttpSession session = registerBrand(uniqueEmail());

        mvc.perform(put("/api/brand/profile").session(session)
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Lileya\"}"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
    }

    // ---------- helpers ----------

    /** Sends the documented request shape; {@code nameJson} is a JSON literal such as {@code "\"Lileya\""}. */
    private ResultActions putName(MockHttpSession session, String nameJson) throws Exception {
        return putProfile(session,
            "{\"name\":" + nameJson + ",\"logoImageId\":null,\"logoUrl\":null,\"consentGiven\":false}");
    }

    private ResultActions putProfile(MockHttpSession session, String body) throws Exception {
        return mvc.perform(put("/api/brand/profile").with(csrf()).session(session)
            .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private MockHttpSession registerBrand(String email) throws Exception {
        return (MockHttpSession) mvc.perform(post("/api/brand/register").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"secret-123\"}"))
            .andExpect(status().isCreated())
            .andReturn().getRequest().getSession(false);
    }

    private static String uniqueEmail() {
        return "brand-" + UUID.randomUUID() + "@example.com";
    }
}
