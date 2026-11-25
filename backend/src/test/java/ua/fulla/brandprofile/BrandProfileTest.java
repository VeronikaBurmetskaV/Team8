package ua.fulla.brandprofile;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import ua.fulla.common.ApiException;
import ua.fulla.common.ErrorCode;
import ua.fulla.common.SessionAccount;
import ua.fulla.common.SessionAccount.AccountType;

/** US-22.1 (brand name) and US-22.2 (one-way consent). */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class BrandProfileTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    BrandProfileService profiles;

    @Test
    void newProfileHasTheRegistrationNameAndWebsiteWithTheDocumentedFields() throws Exception {
        MockHttpSession session = registerBrand(uniqueEmail());

        // US-21: name and website come from registration, so the profile is ACTIVE (domain-model §4.1)
        mvc.perform(get("/api/brand/profile").session(session))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Test Brand"))
            .andExpect(jsonPath("$.websiteUrl").value("https://brand.example.com"))
            .andExpect(jsonPath("$.logoImageId").value((Object) null))
            .andExpect(jsonPath("$.logoUrl").value((Object) null))
            .andExpect(jsonPath("$.consentGiven").value(false))
            .andExpect(jsonPath("$.logoDisplayUrl").value((Object) null))
            .andExpect(jsonPath("$.consentGivenAt").value((Object) null))
            .andExpect(jsonPath("$.consentText").value((Object) null))
            .andExpect(jsonPath("$.state").value("ACTIVE"))
            .andExpect(jsonPath("$.length()").value(13));
    }

    @Test
    void profileWithoutANameIsStillIncomplete() throws Exception {
        // Brands registered before names were asked at registration: the state stays derived.
        String email = uniqueEmail();
        MockHttpSession session = registerBrand(email);
        jdbc.sql("""
                UPDATE brand_profiles SET name = NULL
                WHERE brand_id = (SELECT id FROM brand_accounts WHERE email = :email)
                """).param("email", email).update();

        mvc.perform(get("/api/brand/profile").session(session))
            .andExpect(jsonPath("$.name").value((Object) null))
            .andExpect(jsonPath("$.state").value("INCOMPLETE"));
    }

    @Test
    void websiteUrlIsSavedAndClearedWithTheProfile() throws Exception {
        MockHttpSession session = registerBrand(uniqueEmail());

        putProfile(session, "{\"name\":\"Lileya\",\"websiteUrl\":\" https://lileya.com.ua/uk \",\"logoImageId\":null,"
                + "\"logoUrl\":null,\"consentGiven\":false}")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.websiteUrl").value("https://lileya.com.ua/uk"));

        // PUT replaces the profile: no websiteUrl clears it (it is optional here)
        putName(session, "\"Lileya\"")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.websiteUrl").value((Object) null));
    }

    @Test
    void invalidWebsiteUrlIsRejectedAndNothingIsSaved() throws Exception {
        MockHttpSession session = registerBrand(uniqueEmail());

        for (String websiteUrl : List.of("http://lileya.com.ua", "lileya.com.ua", "https://", "https://lileya",
                "https://1.2.3.4", "")) {
            putProfile(session, "{\"name\":\"Lileya\",\"websiteUrl\":\"" + websiteUrl
                    + "\",\"logoImageId\":null,\"logoUrl\":null,\"consentGiven\":false}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("PROFILE_INVALID"))
                .andExpect(jsonPath("$.error.fields.websiteUrl").value("PROFILE_INVALID"))
                .andExpect(jsonPath("$.error.fields.length()").value(1));
        }
        mvc.perform(get("/api/brand/profile").session(session))
            .andExpect(jsonPath("$.name").value("Test Brand"))
            .andExpect(jsonPath("$.websiteUrl").value("https://brand.example.com"));
    }

    @Test
    void trackingParametersAreRemovedBeforeSaving() throws Exception {
        MockHttpSession session = registerBrand(uniqueEmail());

        // The bug report: a link copied from a search result, with Google's srsltid
        putWebsite(session, "https://goldi.ua/?srsltid=AYCX9vJHexSw4L6lxjK6NUabcDEF123")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.websiteUrl").value("https://goldi.ua/"));
        mvc.perform(get("/api/brand/profile").session(session))
            .andExpect(jsonPath("$.websiteUrl").value("https://goldi.ua/"));

        putWebsite(session, "https://goldi.ua/shop?utm_source=ig&lang=uk&fbclid=x&gclid=y")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.websiteUrl").value("https://goldi.ua/shop?lang=uk"));
    }

    @Test
    void usefulParametersAreKept() throws Exception {
        MockHttpSession session = registerBrand(uniqueEmail());

        putWebsite(session, "https://goldi.ua/?lang=uk")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.websiteUrl").value("https://goldi.ua/?lang=uk"));
    }

    @Test
    void httpGarbageAndTooLongWebsitesAre400OnTheField() throws Exception {
        MockHttpSession session = registerBrand(uniqueEmail());
        String tooLong = "https://goldi.ua/" + "a".repeat(2048);

        for (String websiteUrl : List.of("http://goldi.ua/?lang=uk", "не посилання", "https://goldi", tooLong)) {
            putWebsite(session, websiteUrl)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("PROFILE_INVALID"))
                .andExpect(jsonPath("$.error.fields.websiteUrl").value("PROFILE_INVALID"));
        }
    }

    @Test
    void aDatabaseRuleThatFailsIs400OnItsFieldNot500() {
        // Past Bean Validation (as if a rule drifted): the CHECK on website_url answers.
        UUID brandId = UUID.randomUUID();
        jdbc.sql("INSERT INTO brand_accounts (id, email, password_hash) VALUES (:id, :email, 'x')")
            .param("id", brandId).param("email", uniqueEmail()).update();
        profiles.create(brandId, "Goldi", null);

        assertThatThrownBy(() -> profiles.save(brandId, "Goldi", "http://goldi.ua", null, null, null, false))
            .isInstanceOfSatisfying(ApiException.class, e -> {
                assertThat(e.status()).isEqualTo(HttpStatus.BAD_REQUEST);
                assertThat(e.code()).isEqualTo(ErrorCode.PROFILE_INVALID);
                assertThat(e.fields()).containsExactly(Map.entry("websiteUrl", ErrorCode.PROFILE_INVALID));
            });
        assertThat(profiles.get(brandId).websiteUrl()).isNull();
    }

    @Test
    void validNameMakesTheProfileActive() throws Exception {
        MockHttpSession session = registerBrand(uniqueEmail());

        putName(session, "\"Lileya\"")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Lileya"))
            .andExpect(jsonPath("$.state").value("ACTIVE"))
            .andExpect(jsonPath("$.consentGiven").value(false))
            .andExpect(jsonPath("$.length()").value(13));

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
            .andExpect(jsonPath("$.name").value("Test Brand"));
    }

    // ---------- final-review №3: the logo is refused until it is stored ----------

    @Test
    void validLogoUrlIsRefusedUntilTheLogoIsImplemented() throws Exception {
        MockHttpSession session = registerBrand(uniqueEmail());

        putProfile(session, "{\"name\":\"Lileya\",\"logoImageId\":null,"
                + "\"logoUrl\":\"https://cdn.brand-site.ua/logo.png\",\"consentGiven\":false}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error.code").value("PROFILE_INVALID"))
            .andExpect(jsonPath("$.error.message").isString())
            .andExpect(jsonPath("$.error.fields.logo").value("PROFILE_INVALID"))
            .andExpect(jsonPath("$.error.fields.length()").value(1));

        // the whole request is refused: the name is not saved either
        mvc.perform(get("/api/brand/profile").session(session))
            .andExpect(jsonPath("$.name").value("Test Brand"))
            .andExpect(jsonPath("$.logoUrl").value((Object) null));
    }

    @Test
    void logoImageIdIsRefusedUntilTheLogoIsImplemented() throws Exception {
        MockHttpSession session = registerBrand(uniqueEmail());
        putName(session, "\"Lileya\"").andExpect(status().isOk());

        putProfile(session, "{\"name\":\"Lileya Nova\",\"logoImageId\":\"" + UUID.randomUUID()
                + "\",\"logoUrl\":null,\"consentGiven\":false}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error.code").value("PROFILE_INVALID"))
            .andExpect(jsonPath("$.error.fields.logo").value("PROFILE_INVALID"))
            .andExpect(jsonPath("$.error.fields.length()").value(1));

        mvc.perform(get("/api/brand/profile").session(session))
            .andExpect(jsonPath("$.name").value("Lileya"))
            .andExpect(jsonPath("$.logoImageId").value((Object) null));
    }

    @Test
    void nameWithoutLogoIsStillSaved() throws Exception {
        MockHttpSession session = registerBrand(uniqueEmail());

        // both logo fields null (what the form sends) and the logo fields left out entirely
        putName(session, "\"Lileya\"").andExpect(status().isOk());
        putProfile(session, "{\"name\":\"Lileya Nova\"}")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Lileya Nova"))
            .andExpect(jsonPath("$.logoDisplayUrl").value((Object) null));
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
            .andExpect(jsonPath("$.name").value("Test Brand"));
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
        assertThat(otherName).as("the other brand keeps its registration name").isEqualTo("Test Brand");
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
    // ---------- US-22.2: one-way consent (INV-09, T-5) ----------

    private static String profileBody(String name, boolean consentGiven) {
        return "{\"name\":\"" + name + "\",\"logoImageId\":null,\"logoUrl\":null,\"consentGiven\":"
            + consentGiven + "}";
    }

    @Test
    void consentIsStoredWithTheServerTextAndSurvivesAReload() throws Exception {
        MockHttpSession session = registerBrand(uniqueEmail());
        putName(session, "\"Lileya\"").andExpect(status().isOk());

        putProfile(session, profileBody("Lileya", true))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.consentGiven").value(true))
            .andExpect(jsonPath("$.consentGivenAt").isString())
            .andExpect(jsonPath("$.consentText").value(BrandProfileService.CONSENT_TEXT))
            .andExpect(jsonPath("$.state").value("CONSENTED"));

        // A new GET (page reload) reads the consent from the database.
        mvc.perform(get("/api/brand/profile").session(session))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.consentGiven").value(true))
            .andExpect(jsonPath("$.consentText").value(BrandProfileService.CONSENT_TEXT))
            .andExpect(jsonPath("$.state").value("CONSENTED"));
    }

    @Test
    void consentCanBeGivenTogetherWithTheFirstName() throws Exception {
        MockHttpSession session = registerBrand(uniqueEmail());

        putProfile(session, profileBody("Lileya", true))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Lileya"))
            .andExpect(jsonPath("$.state").value("CONSENTED"));
    }

    @Test
    void consentCannotBeWithdrawnByTheBrand() throws Exception {
        MockHttpSession session = registerBrand(uniqueEmail());
        putProfile(session, profileBody("Lileya", true)).andExpect(status().isOk());

        putProfile(session, profileBody("Other name", false))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error.code").value("CONSENT_LOCKED"))
            .andExpect(jsonPath("$.error.fields").doesNotExist());

        // Nothing was saved: neither the withdrawal nor the new name.
        mvc.perform(get("/api/brand/profile").session(session))
            .andExpect(jsonPath("$.name").value("Lileya"))
            .andExpect(jsonPath("$.consentGiven").value(true))
            .andExpect(jsonPath("$.state").value("CONSENTED"));
    }

    @Test
    void repeatedConsentKeepsTheFirstTimeAndText() throws Exception {
        MockHttpSession session = registerBrand(uniqueEmail());
        putProfile(session, profileBody("Lileya", true)).andExpect(status().isOk());
        UUID brandId = brandIdOf(session);
        jdbc.sql("UPDATE brand_profiles SET consent_given_at = '2026-01-01T00:00:00Z', consent_text = 'shown in January' "
                + "WHERE brand_id = :id")
            .param("id", brandId).update();

        putProfile(session, profileBody("Lileya 2", true))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Lileya 2"))
            .andExpect(jsonPath("$.consentGivenAt").value("2026-01-01T00:00:00Z"))
            .andExpect(jsonPath("$.consentText").value("shown in January"));
    }

    @Test
    void savingTheNameWithoutConsentKeepsTheProfileActive() throws Exception {
        MockHttpSession session = registerBrand(uniqueEmail());

        putProfile(session, profileBody("Lileya", false))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.consentGiven").value(false))
            .andExpect(jsonPath("$.consentText").value((Object) null))
            .andExpect(jsonPath("$.state").value("ACTIVE"));
    }

    private UUID brandIdOf(MockHttpSession session) throws Exception {
        String email = mvc.perform(get("/api/session").session(session))
            .andReturn().getResponse().getContentAsString()
            .replaceAll(".*\"email\":\"([^\"]+)\".*", "$1");
        return jdbc.sql("SELECT id FROM brand_accounts WHERE email = :email")
            .param("email", email)
            .query(UUID.class)
            .single();
    }

    private ResultActions putName(MockHttpSession session, String nameJson) throws Exception {
        return putProfile(session,
            "{\"name\":" + nameJson + ",\"logoImageId\":null,\"logoUrl\":null,\"consentGiven\":false}");
    }

    private ResultActions putWebsite(MockHttpSession session, String websiteUrl) throws Exception {
        return putProfile(session, "{\"name\":\"Goldi\",\"websiteUrl\":\"" + websiteUrl
            + "\",\"logoImageId\":null,\"logoUrl\":null,\"consentGiven\":false}");
    }

    private ResultActions putProfile(MockHttpSession session, String body) throws Exception {
        return mvc.perform(put("/api/brand/profile").with(csrf()).session(session)
            .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private MockHttpSession registerBrand(String email) throws Exception {
        return (MockHttpSession) mvc.perform(post("/api/brand/register").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"secret-123\",\"name\":\"Test Brand\",\"websiteUrl\":\"https://brand.example.com\"}"))
            .andExpect(status().isCreated())
            .andReturn().getRequest().getSession(false);
    }

    private static String uniqueEmail() {
        return "brand-" + UUID.randomUUID() + "@example.com";
    }
}
