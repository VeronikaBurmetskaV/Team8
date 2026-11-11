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
    void registerCreatesAccountWithEmptyProfileAndLogsIn() throws Exception {
        String email = uniqueEmail();

        MvcResult result = register(email, PASSWORD)
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.brandId").isString())
            .andExpect(jsonPath("$.email").value(email))
            .andExpect(jsonPath("$.profileState").value("INCOMPLETE"))
            .andExpect(jsonPath("$.length()").value(3))
            .andReturn();

        // logged in immediately: the session of the response opens the cabinet
        mvc.perform(get("/api/brand/profile").session(sessionOf(result)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.state").value("INCOMPLETE"));

        Integer profiles = jdbc.sql("""
                SELECT count(*) FROM brand_profiles p
                JOIN brand_accounts a ON a.id = p.brand_id
                WHERE a.email = :email AND p.name IS NULL
                """)
            .param("email", email).query(Integer.class).single();
        assertThat(profiles).isEqualTo(1);
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
        for (String email : List.of("info.brand.ua", "info@brand", "info@@brand.ua", "in fo@brand.ua", "@brand.ua", "")) {
            expectEnvelope(register(email, PASSWORD))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("EMAIL_TAKEN_OR_INVALID"))
                .andExpect(jsonPath("$.error.fields.email").value("EMAIL_TAKEN_OR_INVALID"))
                .andExpect(jsonPath("$.error.fields.password").doesNotExist());
        }
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

    // ---------- login / logout (US-21.1) ----------

    @Test
    void loginReturnsProfileStateAndOpensTheCabinet() throws Exception {
        String email = uniqueEmail();
        register(email, PASSWORD).andExpect(status().isCreated());

        MvcResult result = login(email, PASSWORD)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.brandId").isString())
            .andExpect(jsonPath("$.email").value(email))
            .andExpect(jsonPath("$.profileState").value("INCOMPLETE"))
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

    @Test
    void wrongPasswordAndUnknownEmailGiveTheSameAnswer() throws Exception {
        String email = uniqueEmail();
        register(email, PASSWORD).andExpect(status().isCreated());

        MvcResult wrongPassword = expectEnvelope(login(email, "wrong-password"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error.code").value("INVALID_CREDENTIALS"))
            .andExpect(jsonPath("$.error.fields").doesNotExist())
            .andReturn();
        MvcResult unknownEmail = login(uniqueEmail(), PASSWORD)
            .andExpect(status().isUnauthorized())
            .andReturn();

        assertThat(unknownEmail.getResponse().getContentAsString())
            .isEqualTo(wrongPassword.getResponse().getContentAsString());
        // no login happened
        assertThat(wrongPassword.getRequest().getSession(false)).isNull();
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

    private ResultActions register(String email, String password) throws Exception {
        return mvc.perform(post("/api/brand/register").with(csrf())
            .contentType(MediaType.APPLICATION_JSON).content(credentials(email, password)));
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

    private static String credentials(String email, String password) {
        return "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}";
    }

    private static String uniqueEmail() {
        return "brand-" + UUID.randomUUID() + "@example.com";
    }
}
