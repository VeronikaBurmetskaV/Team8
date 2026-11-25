package ua.fulla.catalogimport;

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
import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.convention.TestBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Demo mode of the brand site import (ADR-0017, the setting of application-dev.yml): no
 * ownership check, but the same safe fetcher. Sites live in a {@link FakeWeb}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
@TestPropertySource(properties = "fulla.brand-import.require-site-verification=false")
class BrandSiteImportDemoModeTest {

    static final FakeWeb WEB = new FakeWeb();

    @TestBean
    SiteFetcherFactory siteFetcherFactory;

    static SiteFetcherFactory siteFetcherFactory() {
        return new SiteFetcherFactory(WEB.client(), WEB.resolver(), Duration.ZERO, "FULLA-bot/1.0 (+test)");
    }

    @Autowired
    MockMvc mvc;

    record Brand(MockHttpSession session, String domain) {}

    @Test
    void statusSaysDemoMode() throws Exception {
        Brand brand = brand();

        mvc.perform(get("/api/brand/import/status").session(brand.session()))
            .andExpect(jsonPath("$.verificationRequired").value(false))
            .andExpect(jsonPath("$.demoMode").value(true));
    }

    @Test
    void importWorksWithoutVerification() throws Exception {
        Brand brand = brand();
        WEB.fixture("https://" + brand.domain() + "/products.json?limit=250", "application/json",
            "shopify-products.json");

        postImport(brand).andExpect(status().isAccepted()).andExpect(jsonPath("$.demoMode").value(true));

        waitForImport(brand)
            .andExpect(jsonPath("$.status").value("DONE"))
            .andExpect(jsonPath("$.created").value(1));
        mvc.perform(get("/api/brand/products").session(brand.session()))
            .andExpect(jsonPath("$[0].status").value("DRAFT"));
        // Nothing about ownership was requested: no meta tag page, no verification file.
        assertThat(WEB.requestedUrls()).noneMatch(url -> url.contains("fulla-verification"));
    }

    @Test
    void theSafeFetcherStillRefusesPrivateAddresses() throws Exception {
        Brand brand = brand();
        WEB.dns(brand.domain(), "10.0.0.8");

        postImport(brand).andExpect(status().isAccepted());

        waitForImport(brand)
            .andExpect(jsonPath("$.status").value("FAILED"))
            .andExpect(jsonPath("$.errorCode").value("SITE_UNREACHABLE"));
        assertThat(WEB.requestedUrls()).noneMatch(url -> url.contains(brand.domain()));
    }

    @Test
    void withoutAWebsiteTheImportIsSiteNotSet() throws Exception {
        Brand brand = brand();
        mvc.perform(put("/api/brand/profile").with(csrf()).session(brand.session())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Lileya\",\"websiteUrl\":null,\"feedUrl\":null,\"logoImageId\":null,"
                    + "\"logoUrl\":null,\"consentGiven\":false}"))
            .andExpect(status().isOk());

        postImport(brand).andExpect(status().isConflict())
            .andExpect(jsonPath("$.error.code").value("SITE_NOT_SET"));
    }

    private Brand brand() throws Exception {
        String domain = "d" + UUID.randomUUID().toString().substring(0, 12) + ".ua";
        var result = mvc.perform(post("/api/brand/register").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"owner-" + UUID.randomUUID() + "@gmail.com\",\"password\":\"secret-123\","
                    + "\"name\":\"Lileya\",\"websiteUrl\":\"https://" + domain + "\"}"))
            .andExpect(status().isCreated())
            .andReturn();
        return new Brand((MockHttpSession) result.getRequest().getSession(false), domain);
    }

    private ResultActions postImport(Brand brand) throws Exception {
        return mvc.perform(post("/api/brand/import").with(csrf()).session(brand.session()));
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
}
