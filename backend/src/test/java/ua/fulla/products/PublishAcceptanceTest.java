package ua.fulla.products;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Acceptance tests of US-31 (publish a card to the feed) and US-22.2 (consent), one test per
 * scenario, checked where the buyer sees the result: GET /api/feed. Status codes, ownership and
 * security of the endpoint are in {@link PublishTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class PublishAcceptanceTest {

    private static final String DRESS = "Лляна сукня міді";

    @Autowired
    MockMvc mvc;

    // US-31 S1: «Given consent and a complete card «Лляна сукня міді» … When she presses
    // «Опублікувати у стрічку» … Then the status is «Опубліковано» and the card appears in the
    // swipe feed of FULLA buyers».
    @Test
    void us31_S1_aPublishedCardIsInTheBuyersFeedWithItsData() throws Exception {
        MockHttpSession brand = brand("Lileya", true);
        String id = createDraft(brand);

        publish(brand, id).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PUBLISHED"));

        mvc.perform(get("/api/brand/products").session(brand))
            .andExpect(jsonPath("$[0].id").value(id))
            .andExpect(jsonPath("$[0].status").value("PUBLISHED"));
        Map<String, Object> inFeed = feedCard(id);
        assertThat(inFeed)
            .containsEntry("name", DRESS)
            .containsEntry("brandName", "Lileya")
            .containsEntry("priceUah", 2400)
            .containsEntry("productUrl", ProductTest.PRODUCT_URL);
    }

    // US-31 S2 + US-22.2 S2: «Given a complete draft but no consent … When she tries to publish …
    // Then publishing is blocked, the card stays «Чернетка» and is not in the feed».
    // US-22.2 S1: after the consent is saved, the same draft can be published.
    @Test
    void us31_S2_withoutConsentTheDraftStaysOutOfTheFeedUntilConsentIsGiven() throws Exception {
        MockHttpSession brand = brand("Lileya", false);
        String id = createDraft(brand);

        publish(brand, id)
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error.code").value("CONSENT_REQUIRED"));
        mvc.perform(get("/api/brand/products").session(brand))
            .andExpect(jsonPath("$[0].status").value("DRAFT"));
        assertThat(feedIds()).doesNotContain(id);

        saveProfile(brand, "Lileya", true);

        publish(brand, id).andExpect(status().isOk());
        assertThat(feedIds()).contains(id);
    }

    // ADR-0009 (double click on «Опублікувати у стрічку»): the second press is INVALID_STATE and
    // the buyer sees the card exactly once.
    @Test
    void us31_edge_aDoublePublishShowsTheCardOnceInTheFeed() throws Exception {
        MockHttpSession brand = brand("Lileya", true);
        String id = createDraft(brand);

        publish(brand, id).andExpect(status().isOk());
        publish(brand, id)
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error.code").value("INVALID_STATE"));

        assertThat(feedIds().stream().filter(id::equals)).hasSize(1);
    }

    // US-31 CL: a card is never deleted; «Зняти з публікації» takes it out of the feed and back
    // to «Чернетка», and it can be published again.
    @Test
    void us31_CL_anUnpublishedCardLeavesTheFeedButStaysInTheBrandList() throws Exception {
        MockHttpSession brand = brand("Lileya", true);
        String id = createDraft(brand);
        publish(brand, id).andExpect(status().isOk());

        mvc.perform(post("/api/brand/products/" + id + "/unpublish").with(csrf()).session(brand))
            .andExpect(status().isOk());

        assertThat(feedIds()).doesNotContain(id);
        mvc.perform(get("/api/brand/products").session(brand))
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].status").value("DRAFT"));

        publish(brand, id).andExpect(status().isOk());
        assertThat(feedIds()).contains(id);
    }

    // ---------- helpers ----------

    private ResultActions publish(MockHttpSession brand, String id) throws Exception {
        return mvc.perform(post("/api/brand/products/" + id + "/publish").with(csrf()).session(brand));
    }

    private String createDraft(MockHttpSession brand) throws Exception {
        String body = mvc.perform(post("/api/brand/products").with(csrf()).session(brand)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"" + DRESS + "\",\"priceUah\":2400,\"photoImageId\":null,\"photoUrl\":\""
                    + ProductTest.PHOTO_URL + "\",\"productUrl\":\"" + ProductTest.PRODUCT_URL + "\"}"))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    private String feedJson() throws Exception {
        return mvc.perform(get("/api/feed")).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
    }

    private List<String> feedIds() throws Exception {
        return JsonPath.read(feedJson(), "$.items[*].id");
    }

    private Map<String, Object> feedCard(String id) throws Exception {
        List<Map<String, Object>> found = JsonPath.read(feedJson(), "$.items[?(@.id == '" + id + "')]");
        assertThat(found).as("card %s in GET /api/feed", id).hasSize(1);
        return found.get(0);
    }

    private void saveProfile(MockHttpSession brand, String name, boolean consentGiven) throws Exception {
        mvc.perform(put("/api/brand/profile").with(csrf()).session(brand)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"" + name + "\",\"logoImageId\":null,\"logoUrl\":null,\"consentGiven\":"
                    + consentGiven + "}"))
            .andExpect(status().isOk());
    }

    /** A new brand with a unique email (no shared data between tests) and its profile. */
    private MockHttpSession brand(String name, boolean consentGiven) throws Exception {
        MockHttpSession brand = (MockHttpSession) mvc.perform(post("/api/brand/register").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"brand-" + UUID.randomUUID() + "@example.com\",\"password\":\"secret-123\","
                    + "\"name\":\"Test Brand\",\"websiteUrl\":\"https://brand.example.com\"}"))
            .andExpect(status().isCreated())
            .andReturn().getRequest().getSession(false);
        saveProfile(brand, name, consentGiven);
        return brand;
    }
}
