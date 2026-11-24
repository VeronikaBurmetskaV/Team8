package ua.fulla.products;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import java.time.Instant;
import java.util.List;
import java.util.Map;
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
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ua.fulla.common.SessionAccount;
import ua.fulla.common.SessionAccount.AccountType;

/** POST /api/brand/products/{id}/publish and /unpublish: the publish gate (US-31, US-22.2, T-1, T-4). */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class PublishTest {

    static final String ISO_UTC = ProductTest.ISO_UTC;

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcClient jdbc;

    record Brand(MockHttpSession session, UUID id) {}

    // ---------- US-31 S1: publish with consent ----------

    @Test
    void cardOfAConsentedBrandIsPublished() throws Exception {
        Brand brand = brand("Lileya", true);
        String id = createCard(brand);

        publish(brand, id)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(10))
            .andExpect(jsonPath("$.id").value(id))
            .andExpect(jsonPath("$.name").value("Лляна сукня міді"))
            .andExpect(jsonPath("$.brandName").value("Lileya"))
            .andExpect(jsonPath("$.status").value("PUBLISHED"))
            .andExpect(jsonPath("$.publishedAt").value(matchesPattern(ISO_UTC)))
            .andExpect(jsonPath("$.createdAt").value(matchesPattern(ISO_UTC)));

        Map<String, Object> row = row(id);
        assertThat(row.get("status")).isEqualTo("published");
        assertThat(row.get("published_at")).isNotNull();
        mvc.perform(get("/api/brand/products").session(brand.session()))
            .andExpect(jsonPath("$[0].status").value("PUBLISHED"));
    }

    // ---------- US-31 S2, US-22.2 S2: no consent ----------

    @Test
    void cardOfABrandWithoutConsentIsConsentRequiredAndStaysDraft() throws Exception {
        Brand brand = brand("Lileya", false);
        String id = createCard(brand);

        expectError(publish(brand, id), 409, "CONSENT_REQUIRED")
            .andExpect(jsonPath("$.error.fields").doesNotExist());

        assertThat(row(id).get("status")).isEqualTo("draft");
        assertThat(row(id).get("published_at")).isNull();
        assertThat(feedIds()).doesNotContain(id);
    }

    @Test
    void afterGivingConsentTheSameDraftCanBePublished() throws Exception {
        Brand brand = brand("Lileya", false);
        String id = createCard(brand);
        expectError(publish(brand, id), 409, "CONSENT_REQUIRED");

        saveProfile(brand, "Lileya", true);

        publish(brand, id).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PUBLISHED"));
    }

    // ---------- ownership (INV-07, Q-04) and states (ADR-0009) ----------

    @Test
    void anotherBrandsCardOrAnUnknownIdIsNotFound() throws Exception {
        Brand owner = brand("Owner", true);
        Brand other = brand("Other", true);
        String draft = createCard(owner);
        String published = createCard(owner);
        publish(owner, published).andExpect(status().isOk());

        expectError(publish(other, draft), 404, "NOT_FOUND");
        expectError(publish(other, UUID.randomUUID().toString()), 404, "NOT_FOUND");
        expectError(unpublish(other, published), 404, "NOT_FOUND");
        expectError(unpublish(other, UUID.randomUUID().toString()), 404, "NOT_FOUND");

        // nothing changed for the owner
        assertThat(row(draft).get("status")).isEqualTo("draft");
        assertThat(row(published).get("status")).isEqualTo("published");
    }

    @Test
    void anotherBrandWithoutConsentAlsoGetsNotFoundNotConsentRequired() throws Exception {
        // The card is checked before the consent: a foreign card never reveals anything else.
        Brand owner = brand("Owner", true);
        Brand other = brand("Other", false);

        expectError(publish(other, createCard(owner)), 404, "NOT_FOUND");
    }

    @Test
    void publishingAPublishedCardIsInvalidState() throws Exception {
        Brand brand = brand("Lileya", true);
        String id = createCard(brand);
        String firstPublishedAt = JsonPath.read(publish(brand, id).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString(), "$.publishedAt");

        expectError(publish(brand, id), 409, "INVALID_STATE");

        // a double click does not move the card in the feed
        mvc.perform(get("/api/brand/products").session(brand.session()))
            .andExpect(jsonPath("$[0].publishedAt").value(firstPublishedAt));
    }

    @Test
    void notAUuidIsValidationFailed() throws Exception {
        Brand brand = brand("Lileya", true);

        expectError(publish(brand, "abc"), 400, "VALIDATION_FAILED");
        expectError(unpublish(brand, "abc"), 400, "VALIDATION_FAILED");
    }

    // ---------- unpublish (US-31 CL) ----------

    @Test
    void unpublishReturnsTheCardToDraft() throws Exception {
        Brand brand = brand("Lileya", true);
        String id = createCard(brand);
        publish(brand, id).andExpect(status().isOk());

        unpublish(brand, id)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(10))
            .andExpect(jsonPath("$.id").value(id))
            .andExpect(jsonPath("$.status").value("DRAFT"))
            .andExpect(jsonPath("$.publishedAt").value((Object) null));

        assertThat(row(id).get("status")).isEqualTo("draft");
        assertThat(row(id).get("published_at")).isNull();
        assertThat(feedIds()).doesNotContain(id);
    }

    @Test
    void unpublishingADraftIsInvalidState() throws Exception {
        Brand brand = brand("Lileya", true);
        String id = createCard(brand);

        expectError(unpublish(brand, id), 409, "INVALID_STATE");
        assertThat(row(id).get("status")).isEqualTo("draft");
    }

    @Test
    void republishGetsANewPublishedAt() throws Exception {
        Brand brand = brand("Lileya", true);
        String id = createCard(brand);
        publish(brand, id).andExpect(status().isOk());
        jdbc.sql("UPDATE products SET published_at = '2026-01-01T00:00:00Z' WHERE id = :id")
            .param("id", UUID.fromString(id)).update();
        unpublish(brand, id).andExpect(status().isOk());

        String publishedAt = JsonPath.read(publish(brand, id).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString(), "$.publishedAt");

        assertThat(Instant.parse(publishedAt)).isAfter(Instant.parse("2026-01-01T00:00:00Z"));
    }

    // ---------- security ----------

    @Test
    void publishRequiresABrandSession() throws Exception {
        String id = createCard(brand("Lileya", true));

        expectError(mvc.perform(post("/api/brand/products/" + id + "/publish").with(csrf())), 401, "UNAUTHENTICATED");
        expectError(mvc.perform(post("/api/brand/products/" + id + "/unpublish").with(csrf())), 401, "UNAUTHENTICATED");
        assertThat(row(id).get("status")).isEqualTo("draft");
    }

    @Test
    void buyerSessionIsForbidden() throws Exception {
        String id = createCard(brand("Lileya", true));
        var buyer = new SessionAccount(AccountType.BUYER, UUID.randomUUID(), "buyer@example.com");
        RequestPostProcessor asBuyer = SecurityMockMvcRequestPostProcessors.authentication(
            UsernamePasswordAuthenticationToken.authenticated(
                buyer, null, List.of(new SimpleGrantedAuthority("ROLE_BUYER"))));

        expectError(mvc.perform(post("/api/brand/products/" + id + "/publish").with(asBuyer).with(csrf())),
            403, "FORBIDDEN");
        expectError(mvc.perform(post("/api/brand/products/" + id + "/unpublish").with(asBuyer).with(csrf())),
            403, "FORBIDDEN");
        assertThat(row(id).get("status")).isEqualTo("draft");
    }

    @Test
    void publishWithoutCsrfTokenIsForbidden() throws Exception {
        Brand brand = brand("Lileya", true);
        String id = createCard(brand);

        expectError(mvc.perform(post("/api/brand/products/" + id + "/publish").session(brand.session())),
            403, "FORBIDDEN");
        assertThat(row(id).get("status")).isEqualTo("draft");

        publish(brand, id).andExpect(status().isOk());
        expectError(mvc.perform(post("/api/brand/products/" + id + "/unpublish").session(brand.session())),
            403, "FORBIDDEN");
        assertThat(row(id).get("status")).isEqualTo("published");
    }

    // ---------- helpers ----------

    private ResultActions publish(Brand brand, String id) throws Exception {
        return mvc.perform(post("/api/brand/products/" + id + "/publish").with(csrf()).session(brand.session()));
    }

    private ResultActions unpublish(Brand brand, String id) throws Exception {
        return mvc.perform(post("/api/brand/products/" + id + "/unpublish").with(csrf()).session(brand.session()));
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

    private Map<String, Object> row(String id) {
        return jdbc.sql("SELECT status, published_at FROM products WHERE id = :id")
            .param("id", UUID.fromString(id)).query().singleRow();
    }

    private List<String> feedIds() throws Exception {
        String json = mvc.perform(get("/api/feed")).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return JsonPath.read(json, "$.items[*].id");
    }

    private String createCard(Brand brand) throws Exception {
        String body = mvc.perform(post("/api/brand/products").with(csrf()).session(brand.session())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Лляна сукня міді\",\"priceUah\":2400,\"photoImageId\":null,"
                    + "\"photoUrl\":\"" + ProductTest.PHOTO_URL + "\",\"productUrl\":\"" + ProductTest.PRODUCT_URL + "\"}"))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    private void saveProfile(Brand brand, String name, boolean consentGiven) throws Exception {
        mvc.perform(put("/api/brand/profile").with(csrf()).session(brand.session())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"" + name + "\",\"logoImageId\":null,\"logoUrl\":null,\"consentGiven\":"
                    + consentGiven + "}"))
            .andExpect(status().isOk());
    }

    private Brand brand(String name, boolean consentGiven) throws Exception {
        var result = mvc.perform(post("/api/brand/register").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"brand-" + UUID.randomUUID() + "@example.com\",\"password\":\"secret-123\"}"))
            .andExpect(status().isCreated())
            .andReturn();
        String brandId = JsonPath.read(result.getResponse().getContentAsString(), "$.brandId");
        Brand brand = new Brand((MockHttpSession) result.getRequest().getSession(false), UUID.fromString(brandId));
        saveProfile(brand, name, consentGiven);
        return brand;
    }
}
