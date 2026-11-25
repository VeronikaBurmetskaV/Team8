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
 * Acceptance tests of US-25.1 (manual draft card) and US-26 (product link), one test per
 * scenario of the story, seen from the API: the brand's list and the buyers' feed. The field
 * by field validation lives in {@link ProductTest}; these tests follow the whole scenario.
 */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class CreateCardAcceptanceTest {

    private static final String DRESS = "Лляна сукня міді";

    @Autowired
    MockMvc mvc;

    // US-25.1 S1: «Given an active profile (name saved) … When she enters «Лляна сукня міді», 2400,
    // a photo and the link and saves … Then a new card with the status «Чернетка» is in her list».
    // US-25.1 CL: the brand name comes from the profile; a draft is not in the buyers' feed.
    @Test
    void us25_1_S1_aSavedDraftIsInTheBrandListAndNotInTheFeed() throws Exception {
        MockHttpSession brand = brandWithName("Lileya", false);

        String id = JsonPath.read(createCard(brand, card(DRESS, "2400", ProductTest.PHOTO_URL, ProductTest.PRODUCT_URL))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("DRAFT"))
            .andExpect(jsonPath("$.brandName").value("Lileya"))
            .andReturn().getResponse().getContentAsString(), "$.id");

        mvc.perform(get("/api/brand/products").session(brand))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].id").value(id))
            .andExpect(jsonPath("$[0].name").value(DRESS))
            .andExpect(jsonPath("$[0].priceUah").value(2400))
            .andExpect(jsonPath("$[0].status").value("DRAFT"));
        assertThat(feedIds()).doesNotContain(id);
    }

    // US-25.1 S2: «When she enters -500, zero or text as the price, or adds no photo, and saves …
    // Then the card is not saved». The form keeps the data, so the corrected card saves at once.
    @Test
    void us25_1_S2_aWrongPriceOrNoPhotoSavesNothingAndTheCorrectedCardSaves() throws Exception {
        MockHttpSession brand = brandWithName("Lileya", true);
        List<String> feedBefore = feedIds();

        // text typed into the price field reaches the API as null (US-25.1 S2, api.md §4.1)
        for (String price : List.of("-500", "0", "null")) {
            createCard(brand, card(DRESS, price, ProductTest.PHOTO_URL, ProductTest.PRODUCT_URL))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("CARD_INVALID_PRICE_OR_PHOTO"))
                .andExpect(jsonPath("$.error.fields.priceUah").value("CARD_INVALID_PRICE_OR_PHOTO"));
        }
        createCard(brand, card(DRESS, "2400", null, ProductTest.PRODUCT_URL))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error.code").value("CARD_INVALID_PRICE_OR_PHOTO"))
            .andExpect(jsonPath("$.error.fields.photoUrl").value("CARD_INVALID_PRICE_OR_PHOTO"));

        mvc.perform(get("/api/brand/products").session(brand)).andExpect(jsonPath("$.length()").value(0));
        assertThat(feedIds()).isEqualTo(feedBefore);

        createCard(brand, card(DRESS, "2400", ProductTest.PHOTO_URL, ProductTest.PRODUCT_URL))
            .andExpect(status().isCreated());
        mvc.perform(get("/api/brand/products").session(brand)).andExpect(jsonPath("$.length()").value(1));
    }

    // US-26 CL: «A card without a valid link can be neither saved nor published», even for a brand
    // that has given consent. US-26 S2: «сукня» instead of a URL → the URL hint.
    @Test
    void us26_S2_aCardWithoutAValidLinkIsNotSavedSoItCannotBePublished() throws Exception {
        MockHttpSession brand = brandWithName("Lileya", true);

        for (String productUrl : List.of("сукня", "brand-site.ua/linen-dress", "ftp://brand-site.ua/dress")) {
            createCard(brand, card(DRESS, "2400", ProductTest.PHOTO_URL, productUrl))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("CARD_INVALID_URL"))
                .andExpect(jsonPath("$.error.fields.productUrl").value("CARD_INVALID_URL"));
        }

        mvc.perform(get("/api/brand/products").session(brand)).andExpect(jsonPath("$.length()").value(0));
    }

    // ---------- helpers ----------

    private ResultActions createCard(MockHttpSession brand, String body) throws Exception {
        return mvc.perform(post("/api/brand/products").with(csrf()).session(brand)
            .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    /** Body of POST /api/brand/products; `price` is raw JSON, `photoUrl` null = no photo. */
    private static String card(String name, String price, String photoUrl, String productUrl) {
        return "{\"name\":\"" + name + "\",\"priceUah\":" + price + ",\"photoImageId\":null,\"photoUrl\":"
            + (photoUrl == null ? "null" : "\"" + photoUrl + "\"") + ",\"productUrl\":\"" + productUrl + "\"}";
    }

    private List<String> feedIds() throws Exception {
        String json = mvc.perform(get("/api/feed")).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return JsonPath.read(json, "$.items[*].id");
    }

    /** A new brand with a unique email (no shared data between tests), then its profile. */
    private MockHttpSession brandWithName(String name, boolean consentGiven) throws Exception {
        MockHttpSession brand = (MockHttpSession) mvc.perform(post("/api/brand/register").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"brand-" + UUID.randomUUID() + "@example.com\",\"password\":\"secret-123\","
                    + "\"contactName\":\"Olena\",\"name\":\"Test Brand\",\"websiteUrl\":\"https://brand.example.com\"}"))
            .andExpect(status().isCreated())
            .andReturn().getRequest().getSession(false);
        mvc.perform(put("/api/brand/profile").with(csrf()).session(brand)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"" + name + "\",\"logoImageId\":null,\"logoUrl\":null,\"consentGiven\":"
                    + consentGiven + "}"))
            .andExpect(status().isOk());
        return brand;
    }
}
