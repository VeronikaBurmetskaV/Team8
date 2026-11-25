package ua.fulla.feed;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import java.time.OffsetDateTime;
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
import org.springframework.test.web.servlet.MockMvc;

/**
 * GET /api/feed with brand-made cards (US-08.1, US-08.2): cards reach the feed only through the
 * publish gate. The database is shared with other tests, so every check looks only at this
 * test's own card IDs. Imported cards in the feed are tested in CatalogSyncTest.
 */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class FeedTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcClient jdbc;

    @Test
    void feedIsPublicAndShowsOnlyThePublicCardFields() throws Exception {
        MockHttpSession brand = brand("Lileya");
        String id = publish(brand, createCard(brand, "Лляна сукня"));

        // no session, no CSRF token, no cookie: an anonymous buyer (BR-03, NFR-01)
        String json = mvc.perform(get("/api/feed"))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$.items").isArray())
            .andReturn().getResponse().getContentAsString();

        // PublicCard only: no status, dates, photoImageId, brand ID or logo (US-08.2 CL)
        assertThat(card(json, id)).containsOnlyKeys("id", "name", "brandName", "priceUah", "photoUrl", "productUrl")
            .containsEntry("name", "Лляна сукня")
            .containsEntry("brandName", "Lileya")
            .containsEntry("priceUah", 2400)
            .containsEntry("photoUrl", "https://cdn.brand-site.ua/dress.webp")
            .containsEntry("productUrl", "https://brand-site.ua/dress");
    }

    @Test
    void draftsAndUnpublishedCardsAreNotInTheFeed() throws Exception {
        MockHttpSession brand = brand("Lileya");
        String draft = createCard(brand, "Чернетка");
        String unpublished = publish(brand, createCard(brand, "Знята"));
        mvc.perform(post("/api/brand/products/" + unpublished + "/unpublish").with(csrf()).session(brand))
            .andExpect(status().isOk());

        assertThat(feedIds()).doesNotContain(draft, unpublished);
    }

    @Test
    void brandNameIsTheCurrentProfileName() throws Exception {
        // INV-03: the name is joined from brand_profiles, never copied into the card
        MockHttpSession brand = brand("Lileya");
        String id = publish(brand, createCard(brand, "Сукня"));

        saveProfile(brand, "Lileya Studio");

        assertThat(card(feedJson(), id)).containsEntry("brandName", "Lileya Studio");
    }

    @Test
    void cardsOfOneBrandAreInPublishedAtOrderAndARepublishMovesToTheEnd() throws Exception {
        MockHttpSession brand = brand("Lileya");
        String first = publish(brand, createCard(brand, "Перша"));
        String second = publish(brand, createCard(brand, "Друга"));
        // fixed times instead of two now() calls a few microseconds apart
        setPublishedAt(first, "2026-01-01T00:00:00Z");
        setPublishedAt(second, "2026-01-02T00:00:00Z");

        assertThat(feedIds()).containsSubsequence(first, second);

        mvc.perform(post("/api/brand/products/" + first + "/unpublish").with(csrf()).session(brand))
            .andExpect(status().isOk());
        publish(brand, first);

        assertThat(feedIds()).containsSubsequence(second, first);
    }

    @Test
    void brandsAreMixedRoundByRound() throws Exception {
        // api.md §2.2 «Feed order»: each brand gives its next card per round
        MockHttpSession a = brand("Brand A");
        MockHttpSession b = brand("Brand B");
        String a1 = publish(a, createCard(a, "A1"));
        String a2 = publish(a, createCard(a, "A2"));
        String b1 = publish(b, createCard(b, "B1"));
        String b2 = publish(b, createCard(b, "B2"));
        setPublishedAt(a1, "2026-01-01T00:00:00Z");
        setPublishedAt(a2, "2026-01-02T00:00:00Z");
        setPublishedAt(b1, "2026-01-03T00:00:00Z");
        setPublishedAt(b2, "2026-01-04T00:00:00Z");

        List<String> ids = feedIds();

        // both first cards come before both second cards, although A2 is older than B1
        assertThat(Math.max(ids.indexOf(a1), ids.indexOf(b1)))
            .isLessThan(Math.min(ids.indexOf(a2), ids.indexOf(b2)));
        assertThat(feedIds()).as("deterministic between requests").isEqualTo(ids);
    }

    // ---------- helpers ----------

    private String feedJson() throws Exception {
        return mvc.perform(get("/api/feed")).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
    }

    private List<String> feedIds() throws Exception {
        return JsonPath.read(feedJson(), "$.items[*].id");
    }

    private static Map<String, Object> card(String json, String id) {
        List<Map<String, Object>> cards = JsonPath.read(json, "$.items[?(@.id=='" + id + "')]");
        assertThat(cards).as("card %s in the feed", id).hasSize(1);
        return cards.get(0);
    }

    private void setPublishedAt(String id, String timestamp) {
        jdbc.sql("UPDATE products SET published_at = :t WHERE id = :id")
            .param("t", OffsetDateTime.parse(timestamp)).param("id", UUID.fromString(id)).update();
    }

    private String publish(MockHttpSession brand, String id) throws Exception {
        mvc.perform(post("/api/brand/products/" + id + "/publish").with(csrf()).session(brand))
            .andExpect(status().isOk());
        return id;
    }

    private String createCard(MockHttpSession brand, String name) throws Exception {
        String body = mvc.perform(post("/api/brand/products").with(csrf()).session(brand)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"" + name + "\",\"priceUah\":2400,\"photoImageId\":null,"
                    + "\"photoUrl\":\"https://cdn.brand-site.ua/dress.webp\","
                    + "\"productUrl\":\"https://brand-site.ua/dress\"}"))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    /** Name + consent; consent stays true, because withdrawing it is CONSENT_LOCKED. */
    private void saveProfile(MockHttpSession brand, String name) throws Exception {
        mvc.perform(put("/api/brand/profile").with(csrf()).session(brand)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"" + name + "\",\"logoImageId\":null,\"logoUrl\":null,\"consentGiven\":true}"))
            .andExpect(status().isOk());
    }

    /** A registered brand with a name and consent, ready to publish. */
    private MockHttpSession brand(String name) throws Exception {
        MockHttpSession session = (MockHttpSession) mvc.perform(post("/api/brand/register").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"brand-" + UUID.randomUUID() + "@example.com\",\"password\":\"secret-123\",\"name\":\"Test Brand\",\"websiteUrl\":\"https://brand.example.com\"}"))
            .andExpect(status().isCreated())
            .andReturn().getRequest().getSession(false);
        saveProfile(session, name);
        return session;
    }
}
