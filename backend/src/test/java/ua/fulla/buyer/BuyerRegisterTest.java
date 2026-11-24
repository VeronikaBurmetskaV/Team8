package ua.fulla.buyer;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
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
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import ua.fulla.common.SessionAccount;
import ua.fulla.common.SessionAccount.AccountType;

/** POST /api/buyer/register (US-02, ADR-0006, ADR-0012) and the separation of brand and buyer sessions. */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class BuyerRegisterTest {

    static final String PASSWORD = "secret-123";

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcClient jdbc;

    // ---------- US-02 S1: register = create + log in ----------

    @Test
    void registerCreatesTheAccountAndLogsInAsBuyer() throws Exception {
        String email = uniqueEmail();

        MvcResult result = register(email, PASSWORD)
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$.email").value(email))
            .andReturn();
        MockHttpSession session = sessionOf(result);

        // the session holds the buyer principal with ROLE_BUYER only
        SecurityContext context = (SecurityContext) session.getAttribute(
            HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY);
        assertThat(context.getAuthentication().getAuthorities()).extracting(GrantedAuthority::getAuthority)
            .containsExactly("ROLE_BUYER");
        SessionAccount principal = (SessionAccount) context.getAuthentication().getPrincipal();
        assertThat(principal.accountType()).isEqualTo(AccountType.BUYER);
        assertThat(principal.accountId()).isEqualTo(buyerId(email));

        mvc.perform(get("/api/session").session(session))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.accountType").value("BUYER"))
            .andExpect(jsonPath("$.email").value(email));
    }

    @Test
    void onlyEmailAndBcryptHashAreStored() throws Exception {
        String email = uniqueEmail();
        register(email, PASSWORD).andExpect(status().isCreated());

        var row = jdbc.sql("SELECT * FROM buyer_accounts WHERE email = :email")
            .param("email", email).query().singleRow();
        assertThat(row).containsOnlyKeys("id", "email", "password_hash", "created_at");
        String hash = (String) row.get("password_hash");
        assertThat(hash).startsWith("$2").hasSize(60).doesNotContain(PASSWORD);
        assertThat(new BCryptPasswordEncoder().matches(PASSWORD, hash)).isTrue();
        // a buyer is not a brand
        assertThat(count("brand_accounts", email)).isZero();
    }

    @Test
    void emailIsNormalizedBeforeInsert() throws Exception {
        String id = UUID.randomUUID().toString().substring(0, 8);

        register("  Buyer-" + id + "@Mail.COM ", PASSWORD)
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.email").value("buyer-" + id + "@mail.com"));

        assertThat(count("buyer_accounts", "buyer-" + id + "@mail.com")).isEqualTo(1);
        // the same address in another spelling is taken
        expectError(register("BUYER-" + id + "@mail.com", PASSWORD), 409, "EMAIL_TAKEN_OR_INVALID");
    }

    // ---------- US-02 S2: taken or invalid email ----------

    @Test
    void duplicateEmailIsConflict() throws Exception {
        String email = uniqueEmail();
        register(email, PASSWORD).andExpect(status().isCreated());

        expectError(register(email, "another-password"), 409, "EMAIL_TAKEN_OR_INVALID")
            .andExpect(jsonPath("$.error.fields.email").value("EMAIL_TAKEN_OR_INVALID"))
            .andExpect(jsonPath("$.error.fields.length()").value(1));
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
        assertThat(count("buyer_accounts", email)).isEqualTo(1);
    }

    @Test
    void invalidEmailIsRejected() throws Exception {
        // the same examples as BrandAuthTest and frontend/src/shared/validation.test.ts (R-T17)
        List<String> invalid = List.of("info.brand.ua", "info@brand", "info@@brand.ua", "in fo@brand.ua",
            "@brand.ua", "", "a\\u0000b@brand.ua", "in fo@brand.ua", "info@bra\\u0007nd.ua",
            "a".repeat(246) + "@brand.ua");
        for (String email : invalid) {
            expectError(register(email, PASSWORD), 400, "EMAIL_TAKEN_OR_INVALID")
                .andExpect(jsonPath("$.error.fields.email").value("EMAIL_TAKEN_OR_INVALID"))
                .andExpect(jsonPath("$.error.fields.password").doesNotExist());
        }
    }

    @Test
    void passwordOutsideTheLimitsIsRejected() throws Exception {
        String email = uniqueEmail();
        // 7 characters, and above the 72-byte BCrypt limit (Q-11)
        for (String password : List.of("secret1", "a".repeat(73))) {
            expectError(register(email, password), 400, "PASSWORD_TOO_SHORT")
                .andExpect(jsonPath("$.error.fields.password").value("PASSWORD_TOO_SHORT"))
                .andExpect(jsonPath("$.error.fields.length()").value(1));
        }
        assertThat(count("buyer_accounts", email)).isZero();

        register(email, "secret12").andExpect(status().isCreated());
    }

    @Test
    void emptyBodyReportsBothFieldsWithEmailFirst() throws Exception {
        expectError(mvc.perform(post("/api/buyer/register").with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{}")), 400, "EMAIL_TAKEN_OR_INVALID")
            .andExpect(jsonPath("$.error.fields.email").value("EMAIL_TAKEN_OR_INVALID"))
            .andExpect(jsonPath("$.error.fields.password").value("PASSWORD_TOO_SHORT"))
            .andExpect(jsonPath("$.error.fields.length()").value(2));
    }

    @Test
    void malformedJsonIsValidationFailed() throws Exception {
        expectError(mvc.perform(post("/api/buyer/register").with(csrf())
            .contentType(MediaType.APPLICATION_JSON).content("{\"email\":")), 400, "VALIDATION_FAILED");
    }

    // ---------- separate tables (ADR-0006, ADR-0012) ----------

    @Test
    void theSameEmailCanBeABrandAndABuyer() throws Exception {
        String email = uniqueEmail();
        mvc.perform(post("/api/brand/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(credentials(email, PASSWORD)))
            .andExpect(status().isCreated());

        register(email, "other-password").andExpect(status().isCreated());

        assertThat(count("brand_accounts", email)).isEqualTo(1);
        assertThat(count("buyer_accounts", email)).isEqualTo(1);
    }

    // ---------- role separation ----------

    @Test
    void buyerSessionCannotOpenTheBrandCabinet() throws Exception {
        MockHttpSession buyer = sessionOf(register(uniqueEmail(), PASSWORD).andExpect(status().isCreated()).andReturn());

        expectError(mvc.perform(get("/api/brand/profile").session(buyer)), 403, "FORBIDDEN");
        expectError(mvc.perform(put("/api/brand/profile").with(csrf()).session(buyer)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Lileya\",\"logoImageId\":null,\"logoUrl\":null,\"consentGiven\":true}")),
            403, "FORBIDDEN");
        expectError(mvc.perform(get("/api/brand/products").session(buyer)), 403, "FORBIDDEN");
        expectError(mvc.perform(post("/api/brand/products/" + UUID.randomUUID() + "/publish")
            .with(csrf()).session(buyer)), 403, "FORBIDDEN");
    }

    @Test
    void brandSessionCannotOpenBuyerEndpoints() throws Exception {
        MockHttpSession brand = sessionOf(mvc.perform(post("/api/brand/register").with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(credentials(uniqueEmail(), PASSWORD)))
            .andExpect(status().isCreated()).andReturn());

        // /api/me/** is ROLE_BUYER only (SecurityConfig); the favourites endpoints themselves come later
        expectError(mvc.perform(get("/api/me/favorites").session(brand)), 403, "FORBIDDEN");
        expectError(mvc.perform(post("/api/me/favorites").with(csrf()).session(brand)
            .contentType(MediaType.APPLICATION_JSON).content("{\"productIds\":[]}")), 403, "FORBIDDEN");
        expectError(mvc.perform(get("/api/me/favorites")), 401, "UNAUTHENTICATED");
    }

    @Test
    void buyerRegistrationReplacesABrandLoginInTheSameBrowser() throws Exception {
        MockHttpSession brand = sessionOf(mvc.perform(post("/api/brand/register").with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(credentials(uniqueEmail(), PASSWORD)))
            .andExpect(status().isCreated()).andReturn());
        String buyerEmail = uniqueEmail();

        MockHttpSession buyer = sessionOf(mvc.perform(post("/api/buyer/register").with(csrf()).session(brand)
                .contentType(MediaType.APPLICATION_JSON).content(credentials(buyerEmail, PASSWORD)))
            .andExpect(status().isCreated()).andReturn());

        assertThat(buyer.getId()).isNotEqualTo(brand.getId());
        mvc.perform(get("/api/session").session(buyer))
            .andExpect(jsonPath("$.accountType").value("BUYER"))
            .andExpect(jsonPath("$.email").value(buyerEmail));
        expectError(mvc.perform(get("/api/brand/profile").session(buyer)), 403, "FORBIDDEN");
    }

    @Test
    void registerWithoutCsrfTokenIsForbiddenAndCreatesNothing() throws Exception {
        String email = uniqueEmail();

        expectError(mvc.perform(post("/api/buyer/register")
            .contentType(MediaType.APPLICATION_JSON).content(credentials(email, PASSWORD))), 403, "FORBIDDEN");

        assertThat(count("buyer_accounts", email)).isZero();
    }

    // ---------- helpers ----------

    private ResultActions register(String email, String password) throws Exception {
        return mvc.perform(post("/api/buyer/register").with(csrf())
            .contentType(MediaType.APPLICATION_JSON).content(credentials(email, password)));
    }

    /** JSON escapes such as \u0000 in the examples are kept as written. */
    private static String credentials(String email, String password) {
        return "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}";
    }

    /** The single error envelope: { "error": { "code", "message", "fields"? } }. */
    private static ResultActions expectError(ResultActions actions, int status, String code) throws Exception {
        return actions
            .andExpect(status().is(status))
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$.error.code").value(code))
            .andExpect(jsonPath("$.error.message").isString());
    }

    private static MockHttpSession sessionOf(MvcResult result) {
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private UUID buyerId(String email) {
        return jdbc.sql("SELECT id FROM buyer_accounts WHERE email = :email")
            .param("email", email).query(UUID.class).single();
    }

    private long count(String table, String email) {
        // table is one of two constants in this class, never user input
        return jdbc.sql("SELECT count(*) FROM " + table + " WHERE email = :email")
            .param("email", email).query(Long.class).single();
    }

    private static String uniqueEmail() {
        return "buyer-" + UUID.randomUUID() + "@example.com";
    }
}
