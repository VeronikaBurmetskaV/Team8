package ua.fulla.catalogimport;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.bean.override.convention.TestBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import ua.fulla.products.ProductColor;
import ua.fulla.products.ProductSize;

/**
 * Brand site import (ADR-0017) end to end on embedded Postgres: ownership verification, the
 * import endpoints, storing and re-importing, hand edits, hiding, the frequency limit and bulk
 * publishing. The sites live in a {@link FakeWeb}; every test uses its own domain.
 */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class BrandSiteImportTest {

    static final FakeWeb WEB = new FakeWeb();

    /** The real factory, but on the fake web and without pauses. */
    @TestBean
    SiteFetcherFactory siteFetcherFactory;

    static SiteFetcherFactory siteFetcherFactory() {
        return new SiteFetcherFactory(WEB.client(), WEB.resolver(), Duration.ZERO, "FULLA-bot/1.0 (+test)");
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    BrandImportService imports;

    record Brand(MockHttpSession session, UUID id, String domain) {}

    // ---------- 1. ownership ----------

    @Test
    void metaTagOnTheHomePageVerifiesTheSite() throws Exception {
        Brand brand = brand("owner@gmail.com");
        WEB.html("https://" + brand.domain() + "/",
            "<html><head><meta name=\"fulla-verification\" content=\"" + token(brand) + "\"></head></html>");

        verify(brand).andExpect(status().isOk())
            .andExpect(jsonPath("$.method").value("META_TAG"))
            .andExpect(jsonPath("$.siteDomain").value(brand.domain()))
            .andExpect(jsonPath("$.siteVerifiedAt").isString());

        mvc.perform(get("/api/brand/profile").session(brand.session()))
            .andExpect(jsonPath("$.siteDomain").value(brand.domain()))
            .andExpect(jsonPath("$.siteVerifiedAt").isString());
    }

    @Test
    void verificationFileVerifiesTheSite() throws Exception {
        Brand brand = brand("owner@ukr.net");
        WEB.page("https://" + brand.domain() + "/fulla-verification.txt", "text/plain", token(brand) + "\n");

        verify(brand).andExpect(status().isOk()).andExpect(jsonPath("$.method").value("FILE"));
    }

    @Test
    void emailOnTheSiteDomainVerifiesWithoutAnyRequest() throws Exception {
        String domain = newDomain();
        Brand brand = brand("info@" + domain, domain);

        verify(brand).andExpect(status().isOk()).andExpect(jsonPath("$.method").value("EMAIL_DOMAIN"));
        assertThat(WEB.requestedUrls()).noneMatch(url -> url.contains(domain));
    }

    @Test
    void publicMailServiceDoesNotVerify() throws Exception {
        Brand brand = brand("owner@gmail.com");
        WEB.html("https://" + brand.domain() + "/", "<html><head></head></html>");

        expectError(verify(brand), 409, "SITE_VERIFICATION_FAILED");
        // The token of another brand doesn't verify either.
        WEB.html("https://" + brand.domain() + "/",
            "<meta name=\"fulla-verification\" content=\"" + "0".repeat(32) + "\">");
        expectError(verify(brand), 409, "SITE_VERIFICATION_FAILED");
        assertThat(isVerified(brand)).isFalse();
    }

    @Test
    void unreachableSiteIsSiteUnreachable() throws Exception {
        Brand brand = brand("owner@gmail.com");
        WEB.status("https://" + brand.domain() + "/robots.txt", 503);

        expectError(verify(brand), 502, "SITE_UNREACHABLE");
    }

    @Test
    void siteOnAPrivateAddressIsNeverContacted() throws Exception {
        Brand brand = brand("owner@gmail.com");
        WEB.dns(brand.domain(), "127.0.0.1");

        expectError(verify(brand), 502, "SITE_UNREACHABLE");
        assertThat(WEB.requestedUrls()).noneMatch(url -> url.contains(brand.domain()));
    }

    @Test
    void websiteOnAnotherDomainClearsTheVerification() throws Exception {
        String domain = newDomain();
        Brand brand = brand("info@" + domain, domain);
        verify(brand).andExpect(status().isOk());

        // Another path on the same domain keeps it.
        saveProfile(brand, "https://www." + domain + "/uk", null, false).andExpect(status().isOk());
        assertThat(isVerified(brand)).isTrue();

        saveProfile(brand, "https://" + newDomain(), null, false)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.siteDomain").doesNotExist());
        assertThat(isVerified(brand)).isFalse();
        expectError(postAs(brand, "/api/brand/import"), 403, "SITE_NOT_VERIFIED");
    }

    @Test
    void feedUrlMustBeOnTheWebsiteDomain() throws Exception {
        String domain = newDomain();
        Brand brand = brand("info@" + domain, domain);

        saveProfile(brand, "https://" + domain, "https://feeds." + domain + "/google.xml", false)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.feedUrl").value("https://feeds." + domain + "/google.xml"));
        expectError(saveProfile(brand, "https://" + domain, "https://other.ua/feed.xml", false), 400, "PROFILE_INVALID")
            .andExpect(jsonPath("$.error.fields.feedUrl").value("PROFILE_INVALID"));
        expectError(saveProfile(brand, "https://" + domain, "http://" + domain + "/feed.xml", false), 400,
            "PROFILE_INVALID");
    }

    @Test
    void verifyWithoutAWebsiteIsSiteNotSet() throws Exception {
        Brand brand = brand("owner@gmail.com");
        saveProfile(brand, null, null, false).andExpect(status().isOk());

        expectError(verify(brand), 409, "SITE_NOT_SET");
    }

    // ---------- 2. the import endpoints ----------

    @Test
    void importWithoutVerificationIsRefused() throws Exception {
        Brand brand = brand("owner@gmail.com");

        expectError(postAs(brand, "/api/brand/import"), 403, "SITE_NOT_VERIFIED");
        mvc.perform(get("/api/brand/import/status").session(brand.session()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("IDLE"))
            // Without the dev setting the ownership check is required (the safe default).
            .andExpect(jsonPath("$.verificationRequired").value(true))
            .andExpect(jsonPath("$.demoMode").value(false));
        assertThat(WEB.requestedUrls()).noneMatch(url -> url.contains(brand.domain()));
    }

    @Test
    void importRunsInTheBackgroundAndCreatesDrafts() throws Exception {
        Brand brand = verifiedBrand();
        WEB.fixture("https://" + brand.domain() + "/products.json?limit=250", "application/json",
            "shopify-products.json");

        postAs(brand, "/api/brand/import").andExpect(status().isAccepted())
            .andExpect(jsonPath("$.status").value("RUNNING"))
            .andExpect(jsonPath("$.nextAllowedAt").isString());

        waitForImport(brand)
            .andExpect(jsonPath("$.status").value("DONE"))
            .andExpect(jsonPath("$.method").value("SHOPIFY"))
            .andExpect(jsonPath("$.found").value(3))
            .andExpect(jsonPath("$.created").value(1))
            .andExpect(jsonPath("$.updated").value(0))
            .andExpect(jsonPath("$.skipped").value(2)) // the gift card and the sold-out hoodie
            .andExpect(jsonPath("$.errorCode").doesNotExist())
            .andExpect(jsonPath("$.lastSuccessAt").isString());

        mvc.perform(get("/api/brand/products").session(brand.session()))
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].name").value("Сукня-сорочка з льону"))
            .andExpect(jsonPath("$[0].status").value("DRAFT"))
            .andExpect(jsonPath("$[0].priceUah").value(3100))
            .andExpect(jsonPath("$[0].sourceUrl").value("https://" + brand.domain() + "/products.json?limit=250"));
        assertThat(WEB.requests()).filteredOn(r -> r.uri().getHost().endsWith(brand.domain()))
            .allSatisfy(r -> assertThat(r.headers().firstValue("User-Agent")).hasValue("FULLA-bot/1.0 (+test)"));

        // At most one import per 10 minutes.
        expectError(postAs(brand, "/api/brand/import"), 429, "IMPORT_TOO_FREQUENT");
    }

    @Test
    void siteWithoutProductsEndsWithNoProductsFound() throws Exception {
        Brand brand = verifiedBrand();

        postAs(brand, "/api/brand/import").andExpect(status().isAccepted());

        waitForImport(brand)
            .andExpect(jsonPath("$.status").value("FAILED"))
            .andExpect(jsonPath("$.errorCode").value("NO_PRODUCTS_FOUND"));
    }

    @Test
    void unreachableSiteEndsWithSiteUnreachable() throws Exception {
        Brand brand = verifiedBrand();
        WEB.status("https://" + brand.domain() + "/robots.txt", 500);

        postAs(brand, "/api/brand/import").andExpect(status().isAccepted());

        waitForImport(brand).andExpect(jsonPath("$.errorCode").value("SITE_UNREACHABLE"));
    }

    @Test
    void ofTwoClaimsOnlyOneStartsARun() throws Exception {
        Brand brand = verifiedBrand();
        BrandImportRepository repository = new BrandImportRepository(jdbc);

        assertThat(repository.claim(brand.id(), Duration.ofMinutes(10), Duration.ofHours(1))).isTrue();
        assertThat(repository.claim(brand.id(), Duration.ofMinutes(10), Duration.ofHours(1))).isFalse();
    }

    // ---------- 3. storing and re-importing ----------

    @Test
    void reimportUpdatesWithoutDuplicates() throws Exception {
        Brand brand = brand("owner@gmail.com");

        var first = imports.apply(brand.id(), complete(item("/p/dress", "Сукня", 2400, true)));
        var second = imports.apply(brand.id(), complete(item("/p/dress", "Сукня", 2200, true)));
        var third = imports.apply(brand.id(), complete(item("/p/dress", "Сукня", 2200, true)));

        assertThat(first.created()).isEqualTo(1);
        assertThat(second.created()).isZero();
        assertThat(second.updated()).isEqualTo(1);
        assertThat(third.updated()).as("nothing changed").isZero();
        List<Map<String, Object>> rows = rows(brand);
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).get("price_uah")).isEqualTo(2200);
        assertThat(rows.get(0).get("status")).isEqualTo("draft");
        assertThat(rows.get(0).get("source_url")).isEqualTo("https://" + brand.domain() + "/p/dress");
    }

    @Test
    void handEditedFieldsAreNotOverwritten() throws Exception {
        Brand brand = brand("owner@gmail.com");
        imports.apply(brand.id(), complete(item("/p/dress", "Сукня з сайту", 2400, true)));
        String id = rows(brand).get(0).get("id").toString();

        mvc.perform(put("/api/brand/products/" + id).with(csrf()).session(brand.session())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Моя назва\",\"priceUah\":2000,\"photoImageId\":null,"
                    + "\"photoUrl\":\"https://cdn.example.com/p/dress.jpg\","
                    + "\"productUrl\":\"https://" + brand.domain() + "/p/dress\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Моя назва"))
            .andExpect(jsonPath("$.editedFields").value(containsInAnyOrder("name", "priceUah")));
        // A hand-made card has neither sourceUrl nor editedFields.
        String handMade = createCard(brand);
        mvc.perform(get("/api/brand/products").session(brand.session()))
            .andExpect(jsonPath("$[?(@.id == '" + handMade + "')].editedFields").isEmpty())
            .andExpect(jsonPath("$[?(@.id == '" + id + "')].sourceUrl").isNotEmpty());

        var counts = imports.apply(brand.id(), complete(new ImportedItem("/p/dress", "x", "Нова назва з сайту", 2600,
            "https://cdn.example.com/new.jpg", "https://" + brand.domain() + "/p/dress", true,
            List.of(new ProductSize("S", false)), List.of(new ProductColor("чорний", "#1A1A1A")), "Льон", "Опис")));

        assertThat(counts.updated()).isEqualTo(1);
        Map<String, Object> row = rows(brand).get(0);
        assertThat(row.get("name")).isEqualTo("Моя назва");
        assertThat(row.get("price_uah")).isEqualTo(2000);
        assertThat(row.get("photo_url")).as("the photo was not edited").isEqualTo("https://cdn.example.com/new.jpg");
        assertThat(row.get("material")).isEqualTo("Льон");
        assertThat(row.get("sizes").toString()).contains("\"available\": false");
        assertThat(row.get("edited_fields").toString()).contains("name").contains("price_uah")
            .doesNotContain("photo").doesNotContain("product_url");
    }

    @Test
    void itemsGoneFromACompleteListingAreHiddenNotDeleted() throws Exception {
        Brand brand = brand("owner@gmail.com");
        saveProfile(brand, "https://" + brand.domain(), null, true).andExpect(status().isOk());
        imports.apply(brand.id(), complete(item("/p/a", "Сукня А", 1000, true), item("/p/b", "Сукня Б", 1000, true)));
        publishAll(brand).andExpect(jsonPath("$.publishedIds.length()").value(2));

        // An incomplete run hides nothing.
        imports.apply(brand.id(), new ImportBatch(List.of(item("/p/a", "Сукня А", 1000, true)), false,
            Set.of("/p/a"), "sitemap", null, 0));
        assertThat(statuses(brand)).containsEntry("/p/b", "published");

        var counts = imports.apply(brand.id(), complete(item("/p/a", "Сукня А", 1000, true)));

        assertThat(counts.hidden()).isEqualTo(1);
        assertThat(statuses(brand)).containsEntry("/p/a", "published").containsEntry("/p/b", "draft");
    }

    @Test
    void soldOutItemsAreHiddenAndNewSoldOutItemsAreNotAdded() throws Exception {
        Brand brand = brand("owner@gmail.com");
        saveProfile(brand, "https://" + brand.domain(), null, true).andExpect(status().isOk());
        imports.apply(brand.id(), complete(item("/p/a", "Сукня А", 1000, true)));
        publishAll(brand);

        var counts = imports.apply(brand.id(), complete(item("/p/a", "Сукня А", 1000, false),
            item("/p/new", "Сукня нова", 1000, false)));

        assertThat(counts.hidden()).isEqualTo(1);
        assertThat(counts.skipped()).isEqualTo(1);
        assertThat(statuses(brand)).containsOnly(Map.entry("/p/a", "draft"));
    }

    @Test
    void handMadeCardsAreNeverTouchedByTheImport() throws Exception {
        Brand brand = brand("owner@gmail.com");
        saveProfile(brand, "https://" + brand.domain(), null, true).andExpect(status().isOk());
        String handMade = createCard(brand);
        postAs(brand, "/api/brand/products/" + handMade + "/publish").andExpect(status().isOk());

        imports.apply(brand.id(), complete(item("/p/a", "Сукня А", 1000, true)));

        assertThat(jdbc.sql("SELECT status FROM products WHERE id = :id").param("id", UUID.fromString(handMade))
            .query(String.class).single()).isEqualTo("published");
    }

    // ---------- 4. publishing ----------

    @Test
    void bulkPublishNeedsConsentLikeOneCard() throws Exception {
        Brand brand = brand("owner@gmail.com");
        imports.apply(brand.id(), complete(item("/p/a", "Сукня А", 1000, true)));

        expectError(publishAll(brand), 409, "CONSENT_REQUIRED");
        assertThat(statuses(brand)).containsOnly(Map.entry("/p/a", "draft"));
    }

    @Test
    void bulkPublishPublishesOwnDraftsAndSkipsTheRest() throws Exception {
        Brand brand = brand("owner@gmail.com");
        Brand other = brand("other@gmail.com");
        saveProfile(brand, "https://" + brand.domain(), null, true).andExpect(status().isOk());
        imports.apply(brand.id(), complete(item("/p/a", "Сукня А", 1000, true)));
        String own = rows(brand).get(0).get("id").toString();
        String foreign = createCard(other);

        mvc.perform(post("/api/brand/products/publish").with(csrf()).session(brand.session())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"ids\":[\"" + own + "\",\"" + foreign + "\"]}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.publishedIds[0]").value(own))
            .andExpect(jsonPath("$.skippedIds[0]").value(foreign));

        expectError(mvc.perform(post("/api/brand/products/publish").with(csrf()).session(brand.session())
            .contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[]}")), 400, "VALIDATION_FAILED");
        // A published card is read-only for the brand.
        expectError(mvc.perform(put("/api/brand/products/" + own).with(csrf()).session(brand.session())
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Нова\",\"priceUah\":1,\"photoImageId\":null,\"photoUrl\":\"https://cdn.example.com/a.jpg\","
                + "\"productUrl\":\"https://brand.example.com/a\"}")), 409, "CARD_NOT_EDITABLE");
    }

    // ---------- helpers ----------

    private ImportedItem item(String path, String name, int price, boolean available) {
        return new ImportedItem(path, "x", name, price, "https://cdn.example.com" + path + ".jpg",
            "https://" + currentDomain + path, available, List.of(new ProductSize("M", available)), List.of(), null, null);
    }

    private String currentDomain;

    private static ImportBatch complete(ImportedItem... items) {
        Set<String> listed = new java.util.LinkedHashSet<>();
        for (ImportedItem item : items) {
            listed.add(item.externalId());
        }
        return new ImportBatch(List.of(items), true, listed, "sitemap", null, 0);
    }

    private Brand verifiedBrand() throws Exception {
        String domain = newDomain();
        Brand brand = brand("info@" + domain, domain);
        verify(brand).andExpect(status().isOk());
        return brand;
    }

    private Brand brand(String email) throws Exception {
        return brand(email.replace("@", "-" + UUID.randomUUID().toString().substring(0, 8) + "@"), newDomain());
    }

    private Brand brand(String email, String domain) throws Exception {
        currentDomain = domain;
        var result = mvc.perform(post("/api/brand/register").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"secret-123\",\"name\":\"Lileya\","
                    + "\"websiteUrl\":\"https://" + domain + "\"}"))
            .andExpect(status().isCreated())
            .andReturn();
        String brandId = JsonPath.read(result.getResponse().getContentAsString(), "$.brandId");
        return new Brand((MockHttpSession) result.getRequest().getSession(false), UUID.fromString(brandId), domain);
    }

    private static String newDomain() {
        return "b" + UUID.randomUUID().toString().substring(0, 12) + ".ua";
    }

    private String token(Brand brand) throws Exception {
        String json = mvc.perform(get("/api/brand/profile").session(brand.session()))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String token = JsonPath.read(json, "$.verificationToken");
        assertThat(token).matches("[a-z0-9]{32}");
        return token;
    }

    private boolean isVerified(Brand brand) throws Exception {
        String json = mvc.perform(get("/api/brand/profile").session(brand.session()))
            .andReturn().getResponse().getContentAsString();
        return JsonPath.read(json, "$.siteDomain") != null;
    }

    private ResultActions verify(Brand brand) throws Exception {
        return postAs(brand, "/api/brand/site/verify");
    }

    private ResultActions postAs(Brand brand, String path) throws Exception {
        return mvc.perform(post(path).with(csrf()).session(brand.session()));
    }

    private ResultActions saveProfile(Brand brand, String websiteUrl, String feedUrl, boolean consent) throws Exception {
        return mvc.perform(put("/api/brand/profile").with(csrf()).session(brand.session())
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Lileya\",\"websiteUrl\":" + quoted(websiteUrl) + ",\"feedUrl\":" + quoted(feedUrl)
                + ",\"logoImageId\":null,\"logoUrl\":null,\"consentGiven\":" + consent + "}"));
    }

    private static String quoted(String value) {
        return value == null ? "null" : "\"" + value + "\"";
    }

    private ResultActions publishAll(Brand brand) throws Exception {
        StringBuilder ids = new StringBuilder();
        for (Map<String, Object> row : rows(brand)) {
            ids.append(ids.isEmpty() ? "" : ",").append('"').append(row.get("id")).append('"');
        }
        return mvc.perform(post("/api/brand/products/publish").with(csrf()).session(brand.session())
            .contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[" + ids + "]}"));
    }

    private String createCard(Brand brand) throws Exception {
        String body = mvc.perform(post("/api/brand/products").with(csrf()).session(brand.session())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Ручна сукня\",\"priceUah\":2400,\"photoImageId\":null,"
                    + "\"photoUrl\":\"https://cdn.example.com/x.jpg\",\"productUrl\":\"https://brand.example.com/x\"}"))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    private ResultActions waitForImport(Brand brand) throws Exception {
        for (int i = 0; i < 100; i++) {
            String json = mvc.perform(get("/api/brand/import/status").session(brand.session()))
                .andReturn().getResponse().getContentAsString();
            if (!"RUNNING".equals(JsonPath.read(json, "$.status"))) {
                break;
            }
            Thread.sleep(100);
        }
        return mvc.perform(get("/api/brand/import/status").session(brand.session())).andExpect(status().isOk());
    }

    private List<Map<String, Object>> rows(Brand brand) {
        return jdbc.sql("""
                SELECT id, name, price_uah, photo_url, status, source_url, material, sizes::text AS sizes,
                       array_to_string(edited_fields, ',') AS edited_fields, external_id
                FROM products WHERE brand_id = :id AND external_id IS NOT NULL ORDER BY external_id
                """)
            .param("id", brand.id()).query().listOfRows();
    }

    private Map<String, String> statuses(Brand brand) {
        Map<String, String> result = new java.util.LinkedHashMap<>();
        rows(brand).forEach(row -> result.put((String) row.get("external_id"), (String) row.get("status")));
        return result;
    }

    private static ResultActions expectError(ResultActions actions, int status, String code) throws Exception {
        return actions
            .andExpect(status().is(status))
            .andExpect(jsonPath("$.error.code").value(code))
            .andExpect(jsonPath("$.error.message").isString());
    }
}
