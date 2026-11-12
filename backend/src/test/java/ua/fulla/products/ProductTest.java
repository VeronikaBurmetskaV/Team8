package ua.fulla.products;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import java.util.ArrayList;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import tools.jackson.databind.json.JsonMapper;
import ua.fulla.common.SessionAccount;
import ua.fulla.common.SessionAccount.AccountType;
import ua.fulla.common.ValidationExamples;

/** POST and GET /api/brand/products: create a draft, list own cards (US-25.1, US-26). */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class ProductTest {

    static final String PHOTO_URL = "https://cdn.brand-site.ua/linen-dress.webp";
    static final String PRODUCT_URL = "https://brand-site.ua/linen-dress";
    static final JsonMapper JSON = JsonMapper.builder().build();
    static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};
    /** ISO-8601 in UTC, e.g. 2026-11-03T10:15:00.123456Z (api.md §1). */
    static final String ISO_UTC = "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z";

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcClient jdbc;

    /** A registered brand: its session and the ID from the register response. */
    record Brand(MockHttpSession session, UUID id) {}

    // ---------- US-25.1 S1, US-26 S1: happy path ----------

    @Test
    void cardWithPhotoUrlIsSavedAsDraftWithTheDocumentedFields() throws Exception {
        Brand brand = brandWithName("Lileya");
        // a query in the URL: stored as entered, no utm_source added by the backend (US-32)
        String productUrl = "https://brand-site.ua/product?id=42#reviews";

        String body = createCard(brand, card("\"Лляна сукня міді\"", "2400", "null", json(PHOTO_URL), json(productUrl)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.length()").value(10))
            .andExpect(jsonPath("$.id").isString())
            .andExpect(jsonPath("$.name").value("Лляна сукня міді"))
            .andExpect(jsonPath("$.brandName").value("Lileya"))
            .andExpect(jsonPath("$.priceUah").value(2400))
            .andExpect(jsonPath("$.photoUrl").value(PHOTO_URL))
            .andExpect(jsonPath("$.productUrl").value(productUrl))
            .andExpect(jsonPath("$.photoImageId").value((Object) null))
            .andExpect(jsonPath("$.status").value("DRAFT"))
            .andExpect(jsonPath("$.publishedAt").value((Object) null))
            .andExpect(jsonPath("$.createdAt").value(matchesPattern(ISO_UTC)))
            .andReturn().getResponse().getContentAsString();

        Map<String, Object> row = jdbc.sql("""
                SELECT brand_id, name, price_uah, photo_image_id, photo_url, product_url, status, published_at
                FROM products WHERE id = :id
                """)
            .param("id", UUID.fromString(JsonPath.read(body, "$.id"))).query().singleRow();
        assertThat(row.get("brand_id")).isEqualTo(brand.id());
        assertThat(row.get("name")).isEqualTo("Лляна сукня міді");
        assertThat(row.get("price_uah")).isEqualTo(2400);
        assertThat(row.get("photo_image_id")).isNull();
        assertThat(row.get("photo_url")).isEqualTo(PHOTO_URL);
        assertThat(row.get("product_url")).isEqualTo(productUrl);
        assertThat(row.get("status")).isEqualTo("draft");
        assertThat(row.get("published_at")).isNull();
    }

    @Test
    void cardWithUploadedPhotoPointsToTheImage() throws Exception {
        Brand brand = brandWithName("Lileya");
        String imageId = uploadPng(brand);

        createCard(brand, card("\"Лляна сукня міді\"", "2400", json(imageId), "null", json(PRODUCT_URL)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.photoImageId").value(imageId))
            .andExpect(jsonPath("$.photoUrl").value("/api/images/" + imageId))
            .andExpect(jsonPath("$.status").value("DRAFT"));

        mvc.perform(get("/api/images/" + imageId))
            .andExpect(status().isOk())
            .andExpect(content().bytes(PNG));
    }

    @Test
    void cardWithoutConsentIsStillCreated() throws Exception {
        // Consent is needed only to publish (US-25.1 CL, US-22.2); the profile here is Active.
        Brand brand = brandWithName("Lileya");
        assertThat(jdbc.sql("SELECT consent_given_at IS NULL FROM brand_profiles WHERE brand_id = :id")
            .param("id", brand.id()).query(Boolean.class).single()).isTrue();

        createCard(brand, validCard()).andExpect(status().isCreated());
    }

    @Test
    void nameIsTrimmedAndBoundariesAreAccepted() throws Exception {
        Brand brand = brandWithName("Lileya");

        createCard(brand, card("\"  Сукня  \"", "2400", "null", json(PHOTO_URL), json(PRODUCT_URL)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("Сукня"));
        createCard(brand, card("\"Ш\"", "2400", "null", json(PHOTO_URL), json(PRODUCT_URL)))
            .andExpect(status().isCreated());
        createCard(brand, card(json("я".repeat(100)), "2400", "null", json(PHOTO_URL), json(PRODUCT_URL)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("я".repeat(100)));
    }

    @Test
    void priceBoundariesAreAccepted() throws Exception {
        Brand brand = brandWithName("Lileya");

        for (String price : List.of("1", "1000000")) {
            createCard(brand, card("\"Сукня\"", price, "null", json(PHOTO_URL), json(PRODUCT_URL)))
                .andExpect(status().isCreated());
        }
    }

    @Test
    void productUrlsWithHttpOrHttpsAreAcceptedAsEntered() throws Exception {
        Brand brand = brandWithName("Lileya");

        // the valid examples shared with the frontend (validation.examples.json, final-review №6)
        for (String url : ValidationExamples.httpUrl(true).toList()) {
            createCard(brand, card("\"Сукня\"", "2400", "null", json(PHOTO_URL), jsonString(url)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.productUrl").value(url));
        }
    }

    // ---------- US-25.1 S2, US-26 S2: validation ----------

    @Test
    void invalidNameIsCardInvalidName() throws Exception {
        Brand brand = brandWithName("Lileya");

        for (String name : List.of("\"\"", "\"   \"", "\" \"", json("я".repeat(101)), "null", "\"ab\\u0000cd\"")) {
            expectError(createCard(brand, card(name, "2400", "null", json(PHOTO_URL), json(PRODUCT_URL))),
                    400, "CARD_INVALID_NAME")
                .andExpect(jsonPath("$.error.fields.name").value("CARD_INVALID_NAME"))
                .andExpect(jsonPath("$.error.fields.length()").value(1));
        }
        assertNoCards(brand);
    }

    @Test
    void invalidPriceIsCardInvalidPriceOrPhoto() throws Exception {
        Brand brand = brandWithName("Lileya");

        // null is what the form sends when text was typed into the price field (US-25.1 S2)
        for (String price : List.of("0", "-500", "1000001", "2400.5", "2400.0", "0.5", "null",
                "99999999999999999999")) {
            expectError(createCard(brand, card("\"Сукня\"", price, "null", json(PHOTO_URL), json(PRODUCT_URL))),
                    400, "CARD_INVALID_PRICE_OR_PHOTO")
                .andExpect(jsonPath("$.error.fields.priceUah").value("CARD_INVALID_PRICE_OR_PHOTO"))
                .andExpect(jsonPath("$.error.fields.length()").value(1));
        }
        assertNoCards(brand);
    }

    @Test
    void priceOfTheWrongJsonTypeIsValidationFailed() throws Exception {
        Brand brand = brandWithName("Lileya");

        // "Wrong types" in api.md §3.2; the form itself always sends a number or null.
        expectError(createCard(brand, card("\"Сукня\"", "\"abc\"", "null", json(PHOTO_URL), json(PRODUCT_URL))),
            400, "VALIDATION_FAILED");
    }

    @Test
    void missingPhotoOrBothPhotoSourcesAreCardInvalidPriceOrPhoto() throws Exception {
        Brand brand = brandWithName("Lileya");
        String imageId = uploadPng(brand);

        for (String[] photo : List.of(new String[] {"null", "null"}, new String[] {json(imageId), json(PHOTO_URL)})) {
            expectError(createCard(brand, card("\"Сукня\"", "2400", photo[0], photo[1], json(PRODUCT_URL))),
                    400, "CARD_INVALID_PRICE_OR_PHOTO")
                .andExpect(jsonPath("$.error.fields.photoImageId").value("CARD_INVALID_PRICE_OR_PHOTO"))
                .andExpect(jsonPath("$.error.fields.photoUrl").value("CARD_INVALID_PRICE_OR_PHOTO"))
                .andExpect(jsonPath("$.error.fields.length()").value(2));
        }
        assertNoCards(brand);
    }

    @Test
    void photoUrlMustBeHttps() throws Exception {
        Brand brand = brandWithName("Lileya");

        // the invalid examples shared with the frontend (validation.examples.json) + the length limit
        List<String> invalid = new ArrayList<>(ValidationExamples.httpsUrl(false).toList());
        invalid.add("https://cdn.brand.ua/" + "a".repeat(2048));
        for (String photoUrl : invalid) {
            expectError(createCard(brand, card("\"Сукня\"", "2400", "null", jsonString(photoUrl), json(PRODUCT_URL))),
                    400, "CARD_INVALID_PRICE_OR_PHOTO")
                .andExpect(jsonPath("$.error.fields.photoUrl").value("CARD_INVALID_PRICE_OR_PHOTO"))
                .andExpect(jsonPath("$.error.fields.length()").value(1));
        }
        assertNoCards(brand);
    }

    @Test
    void invalidProductUrlIsCardInvalidUrl() throws Exception {
        Brand brand = brandWithName("Lileya");

        // the invalid examples shared with the frontend (validation.examples.json) + length and null
        List<String> invalid = new ArrayList<>(ValidationExamples.httpUrl(false).map(ProductTest::jsonString).toList());
        invalid.add(json("https://brand.ua/" + "a".repeat(2048)));
        invalid.add("null");
        for (String productUrl : invalid) {
            expectError(createCard(brand, card("\"Сукня\"", "2400", "null", json(PHOTO_URL), productUrl)),
                    400, "CARD_INVALID_URL")
                .andExpect(jsonPath("$.error.fields.productUrl").value("CARD_INVALID_URL"))
                .andExpect(jsonPath("$.error.fields.length()").value(1));
        }
        assertNoCards(brand);
    }

    @Test
    void severalInvalidFieldsAreAllListedAndTheFirstInFormOrderIsTheCode() throws Exception {
        Brand brand = brandWithName("Lileya");

        // The example of api.md §4.1: price -500 and URL «сукня» at once
        expectError(createCard(brand, card("\"Лляна сукня міді\"", "-500", "null", json(PHOTO_URL), json("сукня"))),
                400, "CARD_INVALID_PRICE_OR_PHOTO")
            .andExpect(jsonPath("$.error.fields.length()").value(2))
            .andExpect(jsonPath("$.error.fields.priceUah").value("CARD_INVALID_PRICE_OR_PHOTO"))
            .andExpect(jsonPath("$.error.fields.productUrl").value("CARD_INVALID_URL"));

        // no photo comes before the URL in the form
        expectError(createCard(brand, card("\"Сукня\"", "2400", "null", "null", json("сукня"))),
                400, "CARD_INVALID_PRICE_OR_PHOTO")
            .andExpect(jsonPath("$.error.fields.length()").value(3))
            .andExpect(jsonPath("$.error.fields.productUrl").value("CARD_INVALID_URL"));

        // everything wrong: the name is first
        expectError(createCard(brand, card("\"\"", "0", "null", "null", json("сукня"))), 400, "CARD_INVALID_NAME")
            .andExpect(jsonPath("$.error.fields.length()").value(5));
        assertNoCards(brand);
    }

    // ---------- photo ownership (T-8) and profile gate (T-2) ----------

    @Test
    void anotherBrandsImageOrAnUnknownImageIsNotFound() throws Exception {
        Brand owner = brandWithName("Owner");
        Brand brand = brandWithName("Lileya");
        String foreignImageId = uploadPng(owner);

        for (String imageId : List.of(foreignImageId, UUID.randomUUID().toString())) {
            expectError(createCard(brand, card("\"Сукня\"", "2400", json(imageId), "null", json(PRODUCT_URL))),
                    404, "NOT_FOUND")
                .andExpect(jsonPath("$.error.fields.photoImageId").value("NOT_FOUND"));
        }
        assertNoCards(brand);
    }

    @Test
    void brandWithoutSavedNameCannotCreateCards() throws Exception {
        Brand brand = registerBrand();

        expectError(createCard(brand, validCard()), 409, "PROFILE_INCOMPLETE")
            .andExpect(jsonPath("$.error.fields").doesNotExist());
        // also with an own uploaded image: the profile gate is checked in the insert itself
        String imageId = uploadPng(brand);
        expectError(createCard(brand, card("\"Сукня\"", "2400", json(imageId), "null", json(PRODUCT_URL))),
            409, "PROFILE_INCOMPLETE");
        assertNoCards(brand);
    }

    // ---------- GET /api/brand/products ----------

    @Test
    void listHasOnlyOwnCardsNewestFirst() throws Exception {
        Brand brand = brandWithName("Lileya");
        Brand other = brandWithName("Other");
        createCard(brand, card("\"Перша\"", "1000", "null", json(PHOTO_URL), json(PRODUCT_URL)))
            .andExpect(status().isCreated());
        createCard(other, card("\"Чужа\"", "500", "null", json(PHOTO_URL), json(PRODUCT_URL)))
            .andExpect(status().isCreated());
        String imageId = uploadPng(brand);
        createCard(brand, card("\"Друга\"", "2000", json(imageId), "null", json(PRODUCT_URL)))
            .andExpect(status().isCreated());

        mvc.perform(get("/api/brand/products").session(brand.session()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].name").value("Друга"))
            .andExpect(jsonPath("$[0].brandName").value("Lileya"))
            .andExpect(jsonPath("$[0].priceUah").value(2000))
            .andExpect(jsonPath("$[0].photoImageId").value(imageId))
            .andExpect(jsonPath("$[0].photoUrl").value("/api/images/" + imageId))
            .andExpect(jsonPath("$[0].status").value("DRAFT"))
            .andExpect(jsonPath("$[0].length()").value(10))
            .andExpect(jsonPath("$[1].name").value("Перша"))
            .andExpect(jsonPath("$[1].photoUrl").value(PHOTO_URL))
            .andExpect(jsonPath("$[1].photoImageId").value((Object) null));

        mvc.perform(get("/api/brand/products").session(other.session()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].name").value("Чужа"))
            .andExpect(jsonPath("$[0].brandName").value("Other"));
    }

    @Test
    void newBrandHasAnEmptyList() throws Exception {
        mvc.perform(get("/api/brand/products").session(registerBrand().session()))
            .andExpect(status().isOk())
            .andExpect(content().json("[]"));
    }

    @Test
    void brandNameIsTakenFromTheCurrentProfile() throws Exception {
        // INV-03: the name is joined, not copied into the card
        Brand brand = brandWithName("Lileya");
        createCard(brand, validCard()).andExpect(status().isCreated());

        saveName(brand, "Lileya Studio");

        mvc.perform(get("/api/brand/products").session(brand.session()))
            .andExpect(jsonPath("$[0].brandName").value("Lileya Studio"));
    }

    // ---------- security ----------

    @Test
    void productsRequireABrandSession() throws Exception {
        expectError(mvc.perform(get("/api/brand/products")), 401, "UNAUTHENTICATED");
        expectError(mvc.perform(post("/api/brand/products").with(csrf())
            .contentType(MediaType.APPLICATION_JSON).content(validCard())), 401, "UNAUTHENTICATED");
    }

    @Test
    void buyerSessionIsForbidden() throws Exception {
        var buyer = new SessionAccount(AccountType.BUYER, UUID.randomUUID(), "buyer@example.com");
        RequestPostProcessor asBuyer = SecurityMockMvcRequestPostProcessors.authentication(
            UsernamePasswordAuthenticationToken.authenticated(
                buyer, null, List.of(new SimpleGrantedAuthority("ROLE_BUYER"))));

        expectError(mvc.perform(get("/api/brand/products").with(asBuyer)), 403, "FORBIDDEN");
        expectError(mvc.perform(post("/api/brand/products").with(asBuyer).with(csrf())
            .contentType(MediaType.APPLICATION_JSON).content(validCard())), 403, "FORBIDDEN");
    }

    @Test
    void postWithoutCsrfTokenIsForbidden() throws Exception {
        Brand brand = brandWithName("Lileya");

        expectError(mvc.perform(post("/api/brand/products").session(brand.session())
            .contentType(MediaType.APPLICATION_JSON).content(validCard())), 403, "FORBIDDEN");
        assertNoCards(brand);
    }

    // ---------- helpers ----------

    /** The request of api.md §4.1; every argument is a JSON literal, e.g. {@code "\"Сукня\""} or {@code "null"}. */
    private static String card(String name, String priceUah, String photoImageId, String photoUrl, String productUrl) {
        return "{\"name\":" + name + ",\"priceUah\":" + priceUah + ",\"photoImageId\":" + photoImageId
            + ",\"photoUrl\":" + photoUrl + ",\"productUrl\":" + productUrl + "}";
    }

    private static String validCard() {
        return card("\"Лляна сукня міді\"", "2400", "null", json(PHOTO_URL), json(PRODUCT_URL));
    }

    /** A JSON string literal; the test values contain no quotes or backslashes except deliberate escapes. */
    private static String json(String value) {
        return "\"" + value + "\"";
    }

    /** A JSON string literal with escaping, for examples that contain quotes or control characters. */
    private static String jsonString(String value) {
        return JSON.writeValueAsString(value);
    }

    private ResultActions createCard(Brand brand, String body) throws Exception {
        return mvc.perform(post("/api/brand/products").with(csrf()).session(brand.session())
            .contentType(MediaType.APPLICATION_JSON).content(body));
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

    private void assertNoCards(Brand brand) {
        assertThat(jdbc.sql("SELECT count(*) FROM products WHERE brand_id = :id")
            .param("id", brand.id()).query(Long.class).single()).isZero();
    }

    private String uploadPng(Brand brand) throws Exception {
        String body = mvc.perform(multipart("/api/images")
                .file(new MockMultipartFile("file", "photo.png", "image/png", PNG))
                .with(csrf()).session(brand.session()))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    private Brand brandWithName(String name) throws Exception {
        Brand brand = registerBrand();
        saveName(brand, name);
        return brand;
    }

    private void saveName(Brand brand, String name) throws Exception {
        mvc.perform(put("/api/brand/profile").with(csrf()).session(brand.session())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"" + name + "\",\"logoImageId\":null,\"logoUrl\":null,\"consentGiven\":false}"))
            .andExpect(status().isOk());
    }

    private Brand registerBrand() throws Exception {
        var result = mvc.perform(post("/api/brand/register").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"brand-" + UUID.randomUUID() + "@example.com\",\"password\":\"secret-123\"}"))
            .andExpect(status().isCreated())
            .andReturn();
        String brandId = JsonPath.read(result.getResponse().getContentAsString(), "$.brandId");
        return new Brand((MockHttpSession) result.getRequest().getSession(false), UUID.fromString(brandId));
    }
}
