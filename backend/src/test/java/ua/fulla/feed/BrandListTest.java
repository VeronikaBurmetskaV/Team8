package ua.fulla.feed;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
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
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;

/**
 * GET /api/brands (api.md §2.2, ADR-0015). The database is shared with other tests, so every
 * check looks only at this test's own brand names (a random suffix).
 */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class BrandListTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    BrandListRepository repository;

    @Test
    void consentedBrandIsListedWithItsLogoUrlAndCount() throws Exception {
        String name = unique("Lileya");
        MockHttpSession brand = brand(name, "https://brand-site.ua/logo.png");
        publish(brand, createCard(brand));
        publish(brand, createCard(brand));

        // no session, no CSRF: public like the feed
        String json = mvc.perform(get("/api/brands"))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andReturn().getResponse().getContentAsString();

        assertThat(entry(json, name)).containsOnlyKeys("key", "name", "logoUrl", "productCount")
            .containsEntry("key", name.toLowerCase())
            .containsEntry("logoUrl", "https://brand-site.ua/logo.png")
            .containsEntry("productCount", 2);
    }

    @Test
    void brandWithoutLogoHasNullLogo() throws Exception {
        String name = unique("NoLogo");
        MockHttpSession brand = brand(name, null);
        publish(brand, createCard(brand));

        assertThat(entry(json(), name)).containsEntry("logoUrl", null);
    }

    @Test
    void brandWithoutConsentHasNullLogo() throws Exception {
        // Not reachable through the API (publishing needs consent); the gate must hold anyway.
        String name = unique("NoConsent");
        MockHttpSession brand = brand(name, "https://brand-site.ua/logo.png");
        publish(brand, createCard(brand));
        jdbc.sql("UPDATE brand_profiles SET consent_given_at = NULL, consent_text = NULL WHERE name = :name")
            .param("name", name).update();

        assertThat(entry(json(), name)).containsEntry("logoUrl", null).containsEntry("productCount", 1);
    }

    @Test
    void brandsWithoutPublishedCardsAreNotListed() throws Exception {
        String draftsOnly = unique("Drafts");
        MockHttpSession brand = brand(draftsOnly, "https://brand-site.ua/logo.png");
        createCard(brand);
        String unpublished = unique("Unpublished");
        MockHttpSession other = brand(unpublished, null);
        String id = publish(other, createCard(other));
        mvc.perform(post("/api/brand/products/" + id + "/unpublish").with(csrf()).session(other))
            .andExpect(status().isOk());

        String json = json();
        assertThat(names(json)).doesNotContain(draftsOnly, unpublished);
    }

    @Test
    void importedBrandLogoOnlyWithTheDevFlagAndOnlyForASingleBrandSource() throws Exception {
        String single = unique("Solo");
        UUID soloSource = source("https://solo.example.com/logo.svg");
        importedCard(soloSource, single);
        String market = unique("Market");
        UUID marketSource = source("https://market.example.com/logo.png");
        importedCard(marketSource, market);
        importedCard(marketSource, unique("Other"));

        // Tests run without profile dev: like prod and ops, no source logos at all.
        assertThat(entry(json(), single)).containsEntry("logoUrl", null).containsEntry("productCount", 1);

        // With the flag of application-dev.yml: the logo of a single-brand source only.
        List<BrandSummary> dev = new BrandListService(repository, true).brands();
        assertThat(summary(dev, single).logoUrl()).isEqualTo("https://solo.example.com/logo.svg");
        assertThat(summary(dev, market).logoUrl()).as("a marketplace logo is not the brand's").isNull();
    }

    @Test
    void registeredBrandLogoComesFromTheProfileThenItsSiteThenNone() throws Exception {
        String withBoth = unique("Both");
        MockHttpSession both = brand(withBoth, "https://brand-site.ua/profile-logo.png");
        publish(both, createCard(both));
        siteLogo(withBoth, "https://both.example.com/site-logo.png");
        String siteOnly = unique("SiteOnly");
        MockHttpSession site = brand(siteOnly, null);
        publish(site, createCard(site));
        siteLogo(siteOnly, "https://siteonly.example.com/site-logo.png");
        String none = unique("Monogram");
        MockHttpSession plain = brand(none, null);
        publish(plain, createCard(plain));

        List<BrandSummary> dev = new BrandListService(repository, true).brands();
        assertThat(summary(dev, withBoth).logoUrl()).as("the profile logo first")
            .isEqualTo("https://brand-site.ua/profile-logo.png");
        assertThat(summary(dev, siteOnly).logoUrl()).as("then the site logo (dev)")
            .isEqualTo("https://siteonly.example.com/site-logo.png");
        assertThat(summary(dev, none).logoUrl()).as("then none: the client draws the monogram").isNull();

        // Without the dev flag (prod, ops, these tests' own context) the site logo is never used.
        assertThat(entry(json(), siteOnly)).containsEntry("logoUrl", null);
        assertThat(entry(json(), withBoth)).containsEntry("logoUrl", "https://brand-site.ua/profile-logo.png");
    }

    @Test
    void aRegisteredAndADemoBrandOfTheSameNameAreOneTileWithBothCounts() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        MockHttpSession brand = brand("BEVZA (demo) " + suffix, null);
        publish(brand, createCard(brand));
        publish(brand, createCard(brand));
        importedCard(source(null), "Bevza  (Demo) " + suffix);

        List<Map<String, Object>> found = JsonPath.read(json(), "$[?(@.key == 'bevza (demo) " + suffix + "')]");
        assertThat(found).hasSize(1);
        assertThat(found.get(0)).containsEntry("productCount", 3).containsEntry("name", "BEVZA (demo) " + suffix);
    }

    @Test
    void ownersWithTheSameBrandKeyAreOneBrand() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        MockHttpSession brand = brand("CHER'17 " + suffix, null);
        publish(brand, createCard(brand));
        importedCard(source(null), "cher’17  " + suffix.toUpperCase());

        List<Map<String, Object>> found = JsonPath.read(json(), "$[?(@.key == 'cher\\'17 " + suffix + "')]");
        assertThat(found).hasSize(1);
        assertThat(found.get(0)).containsEntry("productCount", 2).containsEntry("name", "CHER'17 " + suffix);
    }

    // ---------- helpers ----------

    /** What a brand site import with the dev flag stores (BrandImportRepository#saveSiteLogo). */
    private void siteLogo(String brandName, String url) {
        jdbc.sql("""
                INSERT INTO brand_imports (brand_id, site_logo_url)
                SELECT brand_id, :url FROM brand_profiles WHERE name = :name
                ON CONFLICT (brand_id) DO UPDATE SET site_logo_url = EXCLUDED.site_logo_url
                """)
            .param("url", url).param("name", brandName).update();
    }

    private static String unique(String name) {
        return name + " " + UUID.randomUUID().toString().substring(0, 8);
    }

    private String json() throws Exception {
        return mvc.perform(get("/api/brands")).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
    }

    private static List<String> names(String json) {
        return JsonPath.read(json, "$[*].name");
    }

    private static Map<String, Object> entry(String json, String name) {
        List<Map<String, Object>> found = JsonPath.read(json, "$[?(@.name == '" + name + "')]");
        assertThat(found).as("brand %s in /api/brands", name).hasSize(1);
        return found.get(0);
    }

    private static BrandSummary summary(List<BrandSummary> brands, String name) {
        return brands.stream().filter(b -> b.name().equals(name)).findFirst().orElseThrow();
    }

    private UUID source(String logoUrl) {
        String code = "t-" + UUID.randomUUID().toString().substring(0, 8);
        return jdbc.sql("""
                INSERT INTO catalog_sources (code, base_url, logo_url)
                VALUES (:code, :baseUrl, :logoUrl) RETURNING id
                """)
            .param("code", code).param("baseUrl", "https://" + code + ".example.com").param("logoUrl", logoUrl)
            .query(UUID.class).single();
    }

    private void importedCard(UUID sourceId, String brandName) {
        UUID sourceBrand = jdbc.sql("""
                INSERT INTO source_brands (source_id, name) VALUES (:s, :name)
                ON CONFLICT (source_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id
                """)
            .param("s", sourceId).param("name", brandName).query(UUID.class).single();
        jdbc.sql("""
                INSERT INTO products (name, price_uah, photo_url, product_url, status, published_at,
                                      source_id, source_brand_id, external_id, last_synced_at)
                VALUES ('Сукня', 1000, 'https://cdn.example.com/a.jpg', 'https://shop.example.com/a',
                        'published', now(), :s, :b, :e, now())
                """)
            .param("s", sourceId).param("b", sourceBrand).param("e", UUID.randomUUID().toString())
            .update();
    }

    private String publish(MockHttpSession brand, String id) throws Exception {
        mvc.perform(post("/api/brand/products/" + id + "/publish").with(csrf()).session(brand))
            .andExpect(status().isOk());
        return id;
    }

    private String createCard(MockHttpSession brand) throws Exception {
        String body = mvc.perform(post("/api/brand/products").with(csrf()).session(brand)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Сукня\",\"priceUah\":2400,\"photoImageId\":null,"
                    + "\"photoUrl\":\"https://cdn.brand-site.ua/dress.webp\","
                    + "\"productUrl\":\"https://brand-site.ua/dress\"}"))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    /** A registered brand with a name, consent and an optional logo URL, ready to publish. */
    private MockHttpSession brand(String name, String logoUrl) throws Exception {
        MockHttpSession session = (MockHttpSession) mvc.perform(post("/api/brand/register").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"brand-" + UUID.randomUUID() + "@example.com\",\"password\":\"secret-123\",\"contactName\":\"Olena\",\"name\":\"Test Brand\",\"websiteUrl\":\"https://brand.example.com\"}"))
            .andExpect(status().isCreated())
            .andReturn().getRequest().getSession(false);
        mvc.perform(put("/api/brand/profile").with(csrf()).session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"" + name + "\",\"logoImageId\":null,\"logoUrl\":null,\"consentGiven\":true}"))
            .andExpect(status().isOk());
        // PUT /api/brand/profile refuses logos for now ("not supported yet"): set the column directly.
        jdbc.sql("UPDATE brand_profiles SET logo_url = :logoUrl WHERE name = :name")
            .param("logoUrl", logoUrl).param("name", name).update();
        return session;
    }
}
