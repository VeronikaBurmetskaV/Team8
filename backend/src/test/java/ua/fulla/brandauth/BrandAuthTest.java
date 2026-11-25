package ua.fulla.brandauth;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

/** US-21, US-21.1: register, login, logout. */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class BrandAuthTest {

    static final String PASSWORD = "secret-123";

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcClient jdbc;

    // ---------- registration (US-21) ----------

    @Test
    void registerCreatesAccountWithNameAndWebsiteAndLogsIn() throws Exception {
        String email = uniqueEmail();

        MvcResult result = register(email, PASSWORD)
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.brandId").isString())
            .andExpect(jsonPath("$.email").value(email))
            // the name is saved with the account (US-21): ACTIVE, not INCOMPLETE (domain-model.md §4.1)
            .andExpect(jsonPath("$.profileState").value("ACTIVE"))
            .andExpect(jsonPath("$.length()").value(3))
            .andReturn();

        // logged in immediately: the session of the response opens the cabinet
        mvc.perform(get("/api/brand/profile").session(sessionOf(result)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.state").value("ACTIVE"))
            .andExpect(jsonPath("$.name").value("Lileya"))
            .andExpect(jsonPath("$.websiteUrl").value("https://lileya.com.ua"))
            .andExpect(jsonPath("$.consentGiven").value(false));

        Integer profiles = jdbc.sql("""
                SELECT count(*) FROM brand_profiles p
                JOIN brand_accounts a ON a.id = p.brand_id
                WHERE a.email = :email AND p.name = 'Lileya' AND p.website_url = 'https://lileya.com.ua'
                """)
            .param("email", email).query(Integer.class).single();
        assertThat(profiles).as("one profile row with the name and website (T-9)").isEqualTo(1);
    }

    @Test
    void contactNameIsSavedTrimmedAndReturnedByTheProfile() throws Exception {
        String email = uniqueEmail();
        MvcResult result = mvc.perform(post("/api/brand/register").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"contactName\":\"  Олена Коваль \",\"name\":\"Lileya\",\"websiteUrl\":\"https://lileya.com.ua\","
                    + "\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
            .andExpect(status().isCreated())
            .andReturn();

        mvc.perform(get("/api/brand/profile").session(sessionOf(result)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.contactName").value("Олена Коваль"));
        String stored = jdbc.sql("""
                SELECT p.contact_name FROM brand_profiles p
                JOIN brand_accounts a ON a.id = p.brand_id WHERE a.email = :email
                """)
            .param("email", email).query(String.class).single();
        assertThat(stored).isEqualTo("Олена Коваль");
    }

    @Test
    void contactNameIsRequiredWithOneToFiftyCharactersAndNothingIsCreated() throws Exception {
        String email = uniqueEmail();
        for (String contactName : List.of("", "   ", " ", "a".repeat(51), "Ol\\u0007ena")) {
            expectEnvelope(mvc.perform(post("/api/brand/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"contactName\":\"" + contactName + "\",\"name\":\"Lileya\","
                        + "\"websiteUrl\":\"https://lileya.com.ua\",\"email\":\"" + email
                        + "\",\"password\":\"" + PASSWORD + "\"}")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.error.fields.contactName").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.error.fields.length()").value(1));
        }
        // missing altogether
        expectEnvelope(mvc.perform(post("/api/brand/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Lileya\",\"websiteUrl\":\"https://lileya.com.ua\",\"email\":\"" + email
                    + "\",\"password\":\"" + PASSWORD + "\"}")))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"))
            .andExpect(jsonPath("$.error.fields.contactName").value("VALIDATION_FAILED"));
        // exactly 1 and 50 characters are fine
        register50And1();

        Integer accounts = jdbc.sql("SELECT count(*) FROM brand_accounts WHERE email = :email")
            .param("email", email).query(Integer.class).single();
        assertThat(accounts).isZero();
    }

    private void register50And1() throws Exception {
        for (String contactName : List.of("О", "я".repeat(50))) {
            mvc.perform(post("/api/brand/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"contactName\":\"" + contactName + "\",\"name\":\"Lileya\","
                        + "\"websiteUrl\":\"https://lileya.com.ua\",\"email\":\"" + uniqueEmail()
                        + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isCreated());
        }
    }

    @Test
    void nameAndWebsiteHaveTheProfileRulesAndNothingIsCreated() throws Exception {
        String email = uniqueEmail();
        for (String body : List.of(
                // name outside 2–50
                "{\"contactName\":\"Olena\",\"name\":\"L\",\"websiteUrl\":\"https://lileya.com.ua\",",
                "{\"contactName\":\"Olena\",\"name\":\"" + "a".repeat(51) + "\",\"websiteUrl\":\"https://lileya.com.ua\",")) {
            expectEnvelope(mvc.perform(post("/api/brand/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                    .content(body + "\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("PROFILE_INVALID"))
                .andExpect(jsonPath("$.error.fields.name").value("PROFILE_INVALID"))
                .andExpect(jsonPath("$.error.fields.length()").value(1));
        }
        for (String websiteUrl : List.of("http://lileya.com.ua", "lileya.com.ua", "https://", "https://lileya",
                "https://localhost:5173", "")) {
            expectEnvelope(mvc.perform(post("/api/brand/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"contactName\":\"Olena\",\"name\":\"Lileya\",\"websiteUrl\":\"" + websiteUrl + "\",\"email\":\"" + email
                        + "\",\"password\":\"" + PASSWORD + "\"}")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("PROFILE_INVALID"))
                .andExpect(jsonPath("$.error.fields.websiteUrl").value("PROFILE_INVALID"))
                .andExpect(jsonPath("$.error.fields.length()").value(1));
        }
        // the website is required at registration
        expectEnvelope(mvc.perform(post("/api/brand/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"contactName\":\"Olena\",\"name\":\"Lileya\",\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}")))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error.fields.websiteUrl").value("PROFILE_INVALID"));

        Integer accounts = jdbc.sql("SELECT count(*) FROM brand_accounts WHERE email = :email")
            .param("email", email).query(Integer.class).single();
        assertThat(accounts).isZero();
    }

    @Test
    void passwordIsStoredAsBcryptHash() throws Exception {
        String email = uniqueEmail();
        register(email, PASSWORD).andExpect(status().isCreated());

        String hash = jdbc.sql("SELECT password_hash FROM brand_accounts WHERE email = :email")
            .param("email", email).query(String.class).single();

        assertThat(hash).startsWith("$2").hasSize(60).doesNotContain(PASSWORD);
        assertThat(new BCryptPasswordEncoder().matches(PASSWORD, hash)).isTrue();
    }

    @Test
    void emailIsNormalizedBeforeInsertAndLookup() throws Exception {
        String id = UUID.randomUUID().toString().substring(0, 8);

        register(" Brand-" + id + "@Mail.COM ", PASSWORD)
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.email").value("brand-" + id + "@mail.com"));

        Integer stored = jdbc.sql("SELECT count(*) FROM brand_accounts WHERE email = :email")
            .param("email", "brand-" + id + "@mail.com").query(Integer.class).single();
        assertThat(stored).isEqualTo(1);

        // the same address in another spelling is the same account
        login("BRAND-" + id + "@mail.com  ", PASSWORD).andExpect(status().isOk());
        register("brand-" + id + "@MAIL.com", PASSWORD).andExpect(status().isConflict());
    }

    @Test
    void duplicateEmailIsConflict() throws Exception {
        String email = uniqueEmail();
        register(email, PASSWORD).andExpect(status().isCreated());

        expectEnvelope(register(email, "another-password"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error.code").value("EMAIL_TAKEN_OR_INVALID"))
            .andExpect(jsonPath("$.error.fields.email").value("EMAIL_TAKEN_OR_INVALID"));
    }

    @Test
    void twoParallelRegistrationsGiveOneCreatedAndOneConflict() throws Exception {
        String email = uniqueEmail();
        CountDownLatch start = new CountDownLatch(1);
        Callable<Integer> attempt = () -> {
            start.await();
            return register(email, PASSWORD).andReturn().getResponse().getStatus();
        };

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<Integer> first = pool.submit(attempt);
            Future<Integer> second = pool.submit(attempt);
            start.countDown();

            assertThat(List.of(first.get(), second.get())).containsExactlyInAnyOrder(201, 409);
        } finally {
            pool.shutdown();
        }

        Integer accounts = jdbc.sql("SELECT count(*) FROM brand_accounts WHERE email = :email")
            .param("email", email).query(Integer.class).single();
        assertThat(accounts).isEqualTo(1);
    }

    @Test
    void invalidEmailIsRejected() throws Exception {
        // The same examples as frontend/src/shared/validation.test.ts (R-T17). The last three are
        // values the database refuses: U+0000 (written as a JSON escape), a non-breaking space
        // and a control character. They must be a 400, never a 500.
        List<String> invalid = List.of("info.brand.ua", "info@brand", "info@@brand.ua", "in fo@brand.ua",
            "@brand.ua", "", "a\\u0000b@brand.ua", "in\u00A0fo@brand.ua", "info@bra\\u0007nd.ua",
            "a".repeat(246) + "@brand.ua");
        for (String email : invalid) {
            expectEnvelope(register(email, PASSWORD))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("EMAIL_TAKEN_OR_INVALID"))
                .andExpect(jsonPath("$.error.fields.email").value("EMAIL_TAKEN_OR_INVALID"))
                .andExpect(jsonPath("$.error.fields.password").doesNotExist());
        }
    }

    @Test
    void nonBreakingSpacesAroundTheEmailAreTrimmed() throws Exception {
        String id = UUID.randomUUID().toString().substring(0, 8);

        register("\u00A0brand-" + id + "@mail.com\u00A0", PASSWORD)
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.email").value("brand-" + id + "@mail.com"));
    }

    @Test
    void registerWithoutFieldsReportsEveryFieldNameFirst() throws Exception {
        // form order: contact name, name, website, email, password → the top code is the contact
        // name's (api.md §3.1)
        expectEnvelope(mvc.perform(post("/api/brand/register").with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{}")))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"))
            .andExpect(jsonPath("$.error.fields.contactName").value("VALIDATION_FAILED"))
            .andExpect(jsonPath("$.error.fields.name").value("PROFILE_INVALID"))
            .andExpect(jsonPath("$.error.fields.websiteUrl").value("PROFILE_INVALID"))
            .andExpect(jsonPath("$.error.fields.email").value("EMAIL_TAKEN_OR_INVALID"))
            .andExpect(jsonPath("$.error.fields.password").value("PASSWORD_TOO_SHORT"))
            .andExpect(jsonPath("$.error.fields.length()").value(5));
    }

    @Test
    void passwordOfSevenCharactersIsRejected() throws Exception {
        String email = uniqueEmail();

        expectEnvelope(register(email, "1234567"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error.code").value("PASSWORD_TOO_SHORT"))
            .andExpect(jsonPath("$.error.fields.password").value("PASSWORD_TOO_SHORT"));

        // exactly 8 is enough
        register(email, "12345678").andExpect(status().isCreated());
    }

    @Test
    void passwordLongerThanBcryptLimitIsRejected() throws Exception {
        expectEnvelope(register(uniqueEmail(), "x".repeat(73)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error.code").value("PASSWORD_TOO_SHORT"));
    }

    @Test
    void passwordLimitIsCountedInUtf8Bytes() throws Exception {
        // A Cyrillic letter is 2 bytes: 36 letters = 72 bytes fit, 37 letters = 74 bytes do not.
        register(uniqueEmail(), "я".repeat(36)).andExpect(status().isCreated());

        expectEnvelope(register(uniqueEmail(), "я".repeat(37)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error.code").value("PASSWORD_TOO_SHORT"))
            .andExpect(jsonPath("$.error.message").value(
                "password must be at least 8 characters and at most 72 bytes in UTF-8"));
    }

    @Test
    void invalidEmailAndShortPasswordReportBothFieldsWithEmailFirst() throws Exception {
        expectEnvelope(register("no-at-sign", "short"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error.code").value("EMAIL_TAKEN_OR_INVALID"))
            .andExpect(jsonPath("$.error.fields.email").value("EMAIL_TAKEN_OR_INVALID"))
            .andExpect(jsonPath("$.error.fields.password").value("PASSWORD_TOO_SHORT"));
    }

    @Test
    void malformedJsonIsValidationFailed() throws Exception {
        expectEnvelope(mvc.perform(post("/api/brand/register").with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{not json")))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"));
    }

    @Test
    void wrongOrMissingContentTypeIsValidationFailedNotServerError() throws Exception {
        String body = credentials(uniqueEmail(), PASSWORD);

        for (String path : List.of("/api/brand/register", "/api/brand/login")) {
            expectEnvelope(mvc.perform(post(path).with(csrf())
                    .contentType(MediaType.TEXT_PLAIN).content(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"));
            expectEnvelope(mvc.perform(post(path).with(csrf()).content(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"));
        }
    }

    // ---------- login / logout (US-21.1) ----------

    @Test
    void loginReturnsProfileStateAndOpensTheCabinet() throws Exception {
        String email = uniqueEmail();
        register(email, PASSWORD).andExpect(status().isCreated());

        MvcResult result = login(email, PASSWORD)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.brandId").isString())
            .andExpect(jsonPath("$.email").value(email))
            .andExpect(jsonPath("$.profileState").value("ACTIVE"))
            .andExpect(jsonPath("$.length()").value(3))
            .andReturn();

        mvc.perform(get("/api/brand/profile").session(sessionOf(result)))
            .andExpect(status().isOk());
    }

    @Test
    void loginChangesTheSessionId() throws Exception {
        String email = uniqueEmail();
        register(email, PASSWORD).andExpect(status().isCreated());
        MockHttpSession before = new MockHttpSession();
        String idBefore = before.getId();

        MvcResult result = mvc.perform(post("/api/brand/login").with(csrf()).session(before)
                .contentType(MediaType.APPLICATION_JSON).content(credentials(email, PASSWORD)))
            .andExpect(status().isOk())
            .andReturn();

        assertThat(before.isInvalid()).isTrue();
        assertThat(sessionOf(result).getId()).isNotEqualTo(idBefore);
    }

    // ---------- login with the brand name (2026-12-02) ----------

    @Test
    void theBrandNameMatchesWhateverTheCaseSpacesAndUnicodeForm() throws Exception {
        String email = uniqueEmail();
        register(email, PASSWORD).andExpect(status().isCreated()); // saved name: «Lileya»

        // other case, spaces around and a non-breaking space, a fullwidth «Ｌ» (NFKC → «L»)
        for (String typed : List.of("lileya", "  LILEYA ", " Lileya ", "Ｌileya")) {
            mvc.perform(post("/api/brand/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                    .content(credentials(typed, email, PASSWORD)))
                .andExpect(status().isOk());
        }
    }

    @Test
    void repeatedSpacesInsideTheNameCountAsOne() throws Exception {
        String email = uniqueEmail();
        mvc.perform(post("/api/brand/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"contactName\":\"Olena\",\"name\":\"Біла Сукня\",\"websiteUrl\":\"https://lileya.com.ua\","
                    + "\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
            .andExpect(status().isCreated());

        mvc.perform(post("/api/brand/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(credentials("біла    СУКНЯ", email, PASSWORD)))
            .andExpect(status().isOk());
    }

    // ---------- what exactly is wrong (ADR-0018) ----------

    @Test
    void anUnknownEmailIsEmailNotFoundOnTheEmailField() throws Exception {
        expectLoginError(login(uniqueEmail(), PASSWORD), "EMAIL_NOT_FOUND", "email");
    }

    @Test
    void emailsThatCanNeverExistAreEmailNotFoundNeverAServerError() throws Exception {
        // U+0000 as a JSON escape, a non-breaking space inside, not an email at all, empty
        for (String email : List.of("a\\u0000b@example.com", "in\u00A0fo@example.com", "no-at-sign", "")) {
            expectLoginError(login(email, PASSWORD), "EMAIL_NOT_FOUND", "email");
        }
        expectLoginError(mvc.perform(post("/api/brand/login").with(csrf())
            .contentType(MediaType.APPLICATION_JSON).content("{}")), "EMAIL_NOT_FOUND", "email");
    }

    @Test
    void aWrongOrMissingPasswordIsWrongPasswordOnThePasswordField() throws Exception {
        String email = uniqueEmail();
        register(email, PASSWORD).andExpect(status().isCreated());

        expectLoginError(login(email, "wrong-password"), "WRONG_PASSWORD", "password");
        expectLoginError(mvc.perform(post("/api/brand/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"brandName\":\"Lileya\",\"email\":\"" + email + "\"}")), "WRONG_PASSWORD", "password");
        // longer than BCrypt's 72 bytes can never match
        expectLoginError(login(email, "я".repeat(37)), "WRONG_PASSWORD", "password");
    }

    @Test
    void aWrongBrandNameIsBrandNameMismatchOnlyAfterTheRightPassword() throws Exception {
        String email = uniqueEmail();
        register(email, PASSWORD).andExpect(status().isCreated());

        // right email and password, another name (or none)
        expectLoginError(mvc.perform(post("/api/brand/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(credentials("Other brand", email, PASSWORD))), "BRAND_NAME_MISMATCH", "brandName");
        expectLoginError(mvc.perform(post("/api/brand/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}")),
            "BRAND_NAME_MISMATCH", "brandName");
        // a wrong name AND a wrong password: the password is reported, the name is not checked
        expectLoginError(mvc.perform(post("/api/brand/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(credentials("Other brand", email, "wrong-password"))), "WRONG_PASSWORD", "password");
        // an unknown email with a wrong name: the email is reported
        expectLoginError(mvc.perform(post("/api/brand/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(credentials("Other brand", uniqueEmail(), PASSWORD))), "EMAIL_NOT_FOUND", "email");
    }

    @Test
    void anOldAccountWithoutABrandNameLogsInByEmailAndPasswordAndTheNameIsNotSaved() throws Exception {
        String email = uniqueEmail();
        register(email, PASSWORD).andExpect(status().isCreated());
        jdbc.sql("""
                UPDATE brand_profiles SET name = NULL
                WHERE brand_id = (SELECT id FROM brand_accounts WHERE email = :email)
                """)
            .param("email", email).update();

        mvc.perform(post("/api/brand/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(credentials("Будь-яка назва", email, PASSWORD)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.profileState").value("INCOMPLETE"));
        // still the password decides
        login(email, "wrong-password").andExpect(status().isUnauthorized());

        String name = jdbc.sql("""
                SELECT p.name FROM brand_profiles p JOIN brand_accounts a ON a.id = p.brand_id
                WHERE a.email = :email
                """)
            .param("email", email).query(String.class).list().get(0);
        assertThat(name).as("the typed name is not saved").isNull();
    }

    @Test
    void nameKeyNormalizesLikeTheContractSays() {
        assertThat(BrandAuthService.nameKey("  Біла   СУКНЯ ")).isEqualTo("біла сукня");
        assertThat(BrandAuthService.nameKey("Ｌileya")).isEqualTo("lileya");
        assertThat(BrandAuthService.sameBrandName(null, null)).as("no saved name: not checked").isTrue();
        assertThat(BrandAuthService.sameBrandName("Lileya", null)).isFalse();
        assertThat(BrandAuthService.sameBrandName("Lileya", "")).isFalse();
    }

    @Test
    void logoutEndsTheSession() throws Exception {
        String email = uniqueEmail();
        MockHttpSession session = sessionOf(register(email, PASSWORD).andReturn());

        mvc.perform(post("/api/brand/logout").with(csrf()).session(session))
            .andExpect(status().isNoContent());

        assertThat(session.isInvalid()).isTrue();
        expectEnvelope(mvc.perform(get("/api/brand/profile").session(session)))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error.code").value("UNAUTHENTICATED"));
    }

    @Test
    void logoutWithoutSessionIsUnauthenticated() throws Exception {
        expectEnvelope(mvc.perform(post("/api/brand/logout").with(csrf())))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error.code").value("UNAUTHENTICATED"));
    }

    // ---------- CSRF ----------

    @Test
    void postWithoutCsrfTokenIsForbidden() throws Exception {
        String email = uniqueEmail();

        for (String path : List.of("/api/brand/register", "/api/brand/login")) {
            expectEnvelope(mvc.perform(post(path)
                    .contentType(MediaType.APPLICATION_JSON).content(credentials(email, PASSWORD))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
        }

        Integer accounts = jdbc.sql("SELECT count(*) FROM brand_accounts WHERE email = :email")
            .param("email", email).query(Integer.class).single();
        assertThat(accounts).isZero();
    }

    // ---------- helpers ----------

    /**
     * A failed login (ADR-0018): 401, the single envelope, the code at the top and on exactly
     * one field, and no session started.
     */
    private static void expectLoginError(ResultActions actions, String code, String field) throws Exception {
        MvcResult result = expectEnvelope(actions)
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error.code").value(code))
            .andExpect(jsonPath("$.error.fields." + field).value(code))
            .andExpect(jsonPath("$.error.fields.length()").value(1))
            .andReturn();
        assertThat(result.getRequest().getSession(false)).as("no login happened").isNull();
    }

    private ResultActions register(String email, String password) throws Exception {
        return mvc.perform(post("/api/brand/register").with(csrf())
            .contentType(MediaType.APPLICATION_JSON).content(registration(email, password)));
    }

    private ResultActions login(String email, String password) throws Exception {
        return mvc.perform(post("/api/brand/login").with(csrf())
            .contentType(MediaType.APPLICATION_JSON).content(credentials(email, password)));
    }

    /** Every error body is the single envelope: code + message, optionally fields, nothing else. */
    private static ResultActions expectEnvelope(ResultActions actions) throws Exception {
        return actions
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$.error.code").isString())
            .andExpect(jsonPath("$.error.message").isString())
            .andExpect(jsonPath("$.error[?(@.length() > 3)]").doesNotExist());
    }

    private static MockHttpSession sessionOf(MvcResult result) {
        MockHttpSession session = (MockHttpSession) result.getRequest().getSession(false);
        assertThat(session).as("a session was started").isNotNull();
        return session;
    }

    /** A valid registration (US-21): name and website as the form sends them. */
    private static String registration(String email, String password) {
        return "{\"contactName\":\"Olena\",\"name\":\"Lileya\",\"websiteUrl\":\"https://lileya.com.ua\",\"email\":\"" + email
            + "\",\"password\":\"" + password + "\"}";
    }

    /** Login (2026-12-02): the brand name of {@link #registration}, email and password. */
    private static String credentials(String email, String password) {
        return credentials("Lileya", email, password);
    }

    private static String credentials(String brandName, String email, String password) {
        return "{\"brandName\":\"" + brandName + "\",\"email\":\"" + email + "\",\"password\":\""
            + password + "\"}";
    }

    private static String uniqueEmail() {
        return "brand-" + UUID.randomUUID() + "@example.com";
    }
}
