package ua.fulla.buyer;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * {@code POST /api/me/favorites} with the account limit of 100 (ADR-0012, api.md §2.3) and
 * {@code GET /api/me/favorites}. Products are inserted directly: only their IDs matter here.
 */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class FavoritesTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcClient jdbc;

    UUID brandId;

    @BeforeEach
    void brand() {
        brandId = jdbc.sql("INSERT INTO brand_accounts (email, password_hash) VALUES (:email, 'x') RETURNING id")
            .param("email", "brand-" + UUID.randomUUID() + "@example.com").query(UUID.class).single();
        jdbc.sql("INSERT INTO brand_profiles (brand_id, name) VALUES (:id, 'Lileya')").param("id", brandId).update();
    }

    @Test
    void exactlyOneHundredFitAndTheHundredAndFirstIsRefused() throws Exception {
        MockHttpSession buyer = buyer();
        List<UUID> products = products(101);

        add(buyer, products.subList(0, 100))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.productIds.length()").value(100))
            .andExpect(jsonPath("$.skippedIds.length()").value(0));

        add(buyer, List.of(products.get(100)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error.code").value("FAVORITES_LIMIT_REACHED"))
            .andExpect(jsonPath("$.error.message").isString());

        assertThat(saved(buyer)).hasSize(100).doesNotContain(products.get(100));
    }

    @Test
    void mergeAddsNewIdsInRequestOrderUntilTheLimitAndReportsTheRest() throws Exception {
        MockHttpSession buyer = buyer();
        List<UUID> products = products(103);
        add(buyer, products.subList(0, 98)).andExpect(status().isOk());

        // the guest's list after login: one already saved, three new, one unknown
        UUID unknown = UUID.randomUUID();
        List<UUID> guest = List.of(products.get(0), products.get(100), products.get(101), products.get(102), unknown);
        String body = add(buyer, guest)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.productIds.length()").value(100))
            .andReturn().getResponse().getContentAsString();

        List<String> ids = JsonPath.read(body, "$.productIds");
        List<String> skipped = JsonPath.read(body, "$.skippedIds");
        // the first two new ones fit, in request order, after the older likes
        assertThat(ids.subList(98, 100)).containsExactly(products.get(100).toString(), products.get(101).toString());
        // only the new one that did not fit; unknown IDs are ignored, not "skipped"
        assertThat(skipped).containsExactly(products.get(102).toString());
    }

    @Test
    void alreadySavedIdsNeverHitTheLimit() throws Exception {
        MockHttpSession buyer = buyer();
        List<UUID> products = products(100);
        add(buyer, products).andExpect(status().isOk());

        // a retry or a second like of a saved product: idempotent, not a 409
        add(buyer, products.subList(0, 3))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.productIds.length()").value(100))
            .andExpect(jsonPath("$.skippedIds.length()").value(0));
    }

    @Test
    void getReturnsTheListOldestLikeFirst() throws Exception {
        MockHttpSession buyer = buyer();
        List<UUID> products = products(3);
        add(buyer, List.of(products.get(2), products.get(0))).andExpect(status().isOk());
        add(buyer, List.of(products.get(1))).andExpect(status().isOk());

        assertThat(saved(buyer)).containsExactly(products.get(2), products.get(0), products.get(1));
    }

    @Test
    void moreThanFiveHundredIdsAreAValidationError() throws Exception {
        List<UUID> ids = IntStream.range(0, 501).mapToObj(i -> UUID.randomUUID()).toList();
        add(buyer(), ids)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"));
    }

    @Test
    void onlyABuyerSessionMayUseIt() throws Exception {
        mvc.perform(get("/api/me/favorites")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/me/favorites").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"productIds\":[]}"))
            .andExpect(status().isUnauthorized());

        // a brand session is the wrong account type (ADR-0006)
        MockHttpSession brand = (MockHttpSession) mvc.perform(post("/api/brand/register").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"contactName\":\"Olena\",\"name\":\"Lileya\",\"websiteUrl\":\"https://lileya.com.ua\",\"email\":\"brand-"
                    + UUID.randomUUID() + "@example.com\",\"password\":\"secret-123\"}"))
            .andExpect(status().isCreated())
            .andReturn().getRequest().getSession(false);
        mvc.perform(get("/api/me/favorites").session(brand))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
    }

    // ---------- helpers ----------

    private ResultActions add(MockHttpSession buyer, List<UUID> ids) throws Exception {
        String json = ids.stream().map(id -> "\"" + id + "\"").collect(Collectors.joining(","));
        return mvc.perform(post("/api/me/favorites").with(csrf()).session(buyer)
            .contentType(MediaType.APPLICATION_JSON).content("{\"productIds\":[" + json + "]}"));
    }

    private List<UUID> saved(MockHttpSession buyer) throws Exception {
        String body = mvc.perform(get("/api/me/favorites").session(buyer))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        List<String> ids = JsonPath.read(body, "$.productIds");
        return ids.stream().map(UUID::fromString).toList();
    }

    private List<UUID> products(int count) {
        List<UUID> ids = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            ids.add(jdbc.sql("""
                    INSERT INTO products (brand_id, name, price_uah, photo_url, product_url, status)
                    VALUES (:brand, 'Сукня', 1000, 'https://cdn.example.com/a.jpg', 'https://shop.example.com/a', 'draft')
                    RETURNING id
                    """).param("brand", brandId).query(UUID.class).single());
        }
        return ids;
    }

    private MockHttpSession buyer() throws Exception {
        return (MockHttpSession) mvc.perform(post("/api/buyer/register").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Софія\",\"login\":\"buyer-" + UUID.randomUUID() + "@example.com\",\"password\":\"secret-123\"}"))
            .andExpect(status().isCreated())
            .andReturn().getRequest().getSession(false);
    }
}
