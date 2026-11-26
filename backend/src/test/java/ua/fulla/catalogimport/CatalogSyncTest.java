package ua.fulla.catalogimport;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.ApplicationContext;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import ua.fulla.products.ProductColor;
import ua.fulla.products.ProductSize;

/**
 * Storing imported items on embedded Postgres (ADR-0014, data-model.md §5.4 T-15…T-18) and the
 * imported cards in {@code GET /api/feed}. Every test uses its own source, so tests don't see
 * each other's cards. Nothing here touches the network.
 */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class CatalogSyncTest {

    @Autowired
    CatalogSyncService sync;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    MockMvc mvc;

    @Autowired
    ApplicationContext context;

    String code;
    UUID sourceId;

    @BeforeEach
    void newSource() {
        code = "t-" + UUID.randomUUID().toString().substring(0, 8);
        sourceId = sync.registerSource(code, "https://" + code + ".example.com");
    }

    // ---------- T-15: upsert ----------

    @Test
    void sameExternalIdIsStoredOnceWithinARunAndAcrossRuns() {
        sync.apply(sourceId, complete(item("A", 1000, true), item("A", 1200, true)));
        sync.apply(sourceId, complete(item("A", 1000, true)));

        assertThat(rows()).hasSize(1);
        assertThat(card("A").get("price_uah")).as("first occurrence of a run wins").isEqualTo(1000);
    }

    @Test
    void newPriceAndSizesUpdateTheCardAndKeepItsFeedPosition() {
        sync.apply(sourceId, complete(item("A", 1000, true)));
        OffsetDateTime publishedAt = publishedAt("A");

        ImportedItem changed = new ImportedItem("A", "Test Brand", "Нова назва", 1350, "https://cdn.example.com/a2.jpg",
            "https://shop.example.com/a", true, List.of(new ProductSize("L", true)), List.of(), "Льон 100%", null);
        RunStatus status = sync.apply(sourceId, complete(changed));

        Map<String, Object> row = card("A");
        assertThat(status).isEqualTo(RunStatus.OK);
        assertThat(row.get("price_uah")).isEqualTo(1350);
        assertThat(row.get("name")).isEqualTo("Нова назва");
        assertThat(row.get("sizes").toString()).isEqualTo("[{\"label\": \"L\", \"available\": true}]");
        assertThat(row.get("colors")).as("empty list stored as NULL").isNull();
        assertThat(row.get("description")).isNull();
        assertThat(row.get("status")).isEqualTo("published");
        assertThat(publishedAt("A")).isEqualTo(publishedAt);
    }

    @Test
    void outOfStockItemGoesToDraftAndBackToTheEndOfTheFeedWhenAvailableAgain() {
        sync.apply(sourceId, complete(item("A", 1000, true)));
        OffsetDateTime first = publishedAt("A");

        sync.apply(sourceId, complete(item("A", 1000, false)));
        assertThat(card("A").get("status")).isEqualTo("draft");
        assertThat(card("A").get("published_at")).isNull();

        sync.apply(sourceId, complete(item("A", 1000, true)));
        assertThat(card("A").get("status")).isEqualTo("published");
        assertThat(publishedAt("A")).isAfter(first);
    }

    // ---------- T-16: hide missing items ----------

    @Test
    void itemsMissingFromACompleteRunAreHiddenNotDeleted() {
        sync.apply(sourceId, complete(item("A", 1000, true), item("B", 2000, true)));

        sync.apply(sourceId, complete(item("A", 1000, true)));

        assertThat(rows()).hasSize(2);
        assertThat(card("A").get("status")).isEqualTo("published");
        assertThat(card("B").get("status")).isEqualTo("draft");
        assertThat(card("B").get("published_at")).isNull();
    }

    @Test
    void anIncompleteRunHidesNothing() {
        sync.apply(sourceId, complete(item("A", 1000, true), item("B", 2000, true)));

        RunStatus status = sync.apply(sourceId, new ImportBatch(List.of(item("A", 1100, true)), false));

        assertThat(status).isEqualTo(RunStatus.PARTIAL);
        assertThat(card("A").get("price_uah")).as("what was read is still stored").isEqualTo(1100);
        assertThat(card("B").get("status")).isEqualTo("published");
    }

    @Test
    void anEmptyCompleteRunHidesAllCardsOfThatSourceOnly() {
        sync.apply(sourceId, complete(item("A", 1000, true)));
        UUID otherSource = sync.registerSource(code + "-x", "https://other.example.com");
        sync.apply(otherSource, complete(item("A", 1000, true)));

        sync.apply(sourceId, complete());

        assertThat(card("A").get("status")).isEqualTo("draft");
        assertThat(jdbc.sql("SELECT status FROM products WHERE source_id = :s").param("s", otherSource)
            .query(String.class).single()).isEqualTo("published");
    }

    // ---------- T-18: run-interval gate ----------

    private static final Duration SIX_HOURS = Duration.ofHours(6);

    private void lastRunAgo(String interval) {
        jdbc.sql("UPDATE catalog_sources SET last_run_at = now() - CAST(:i AS interval) WHERE code = :c")
            .param("i", interval)
            .param("c", code)
            .update();
    }

    @Test
    void aSourceCanBeClaimedOnlyOnceInSixHoursByDefault() {
        assertThat(sync.claimRun(code, SIX_HOURS)).isTrue();
        assertThat(sync.claimRun(code, SIX_HOURS)).isFalse();

        lastRunAgo("5 hours 59 minutes");
        assertThat(sync.claimRun(code, SIX_HOURS)).isFalse();

        lastRunAgo("6 hours 1 minute");
        assertThat(sync.claimRun(code, SIX_HOURS)).isTrue();
    }

    @Test
    void theGateUsesTheGivenInterval() {
        Duration oneHour = Duration.ofHours(1);
        assertThat(sync.claimRun(code, oneHour)).isTrue();

        lastRunAgo("59 minutes");
        assertThat(sync.claimRun(code, oneHour)).isFalse();

        lastRunAgo("61 minutes");
        assertThat(sync.claimRun(code, oneHour)).isTrue();
    }

    @Test
    void ofTwoParallelClaimsOnlyOneWins() throws Exception {
        CountDownLatch start = new CountDownLatch(1);
        Callable<Boolean> claim = () -> {
            start.await();
            return sync.claimRun(code, SIX_HOURS);
        };
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<Boolean> a = pool.submit(claim);
            Future<Boolean> b = pool.submit(claim);
            start.countDown();
            assertThat(List.of(a.get(), b.get())).containsExactlyInAnyOrder(true, false);
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void runStatusIsStored() {
        sync.finishRun(code, RunStatus.PARTIAL);

        assertThat(jdbc.sql("SELECT last_run_status FROM catalog_sources WHERE code = :c").param("c", code)
            .query(String.class).single()).isEqualTo("partial");
    }

    // ---------- per-size quantities (data-model.md §5.3) ----------

    @Test
    void quantitiesAreStoredUpdatedAndDroppedByTheNextSuccessfulRun() {
        sync.apply(sourceId, complete(withSizes("A", new ProductSize("S", true, 2), new ProductSize("M", true))));
        assertThat(card("A").get("sizes").toString()).isEqualTo(
            "[{\"label\": \"S\", \"quantity\": 2, \"available\": true}, {\"label\": \"M\", \"available\": true}]");

        // the next run reads new counts: they replace the old ones
        sync.apply(sourceId, complete(withSizes("A", new ProductSize("S", true, 1), new ProductSize("M", true, 4))));
        assertThat(card("A").get("sizes").toString()).isEqualTo(
            "[{\"label\": \"S\", \"quantity\": 1, \"available\": true}, {\"label\": \"M\", \"quantity\": 4, \"available\": true}]");

        // a successful run without counts: the old counts are not kept
        sync.apply(sourceId, complete(withSizes("A", new ProductSize("S", true), new ProductSize("M", false))));
        assertThat(card("A").get("sizes").toString()).isEqualTo(
            "[{\"label\": \"S\", \"available\": true}, {\"label\": \"M\", \"available\": false}]");
    }

    @Test
    void anIncompleteRunWithoutTheItemNeitherChangesItsSizesNorHidesIt() {
        sync.apply(sourceId, complete(withSizes("A", new ProductSize("S", true, 2))));
        String before = card("A").get("sizes").toString();

        RunStatus status = sync.apply(sourceId, new ImportBatch(List.of(), false));

        assertThat(status).isEqualTo(RunStatus.PARTIAL);
        assertThat(card("A").get("sizes").toString()).isEqualTo(before);
        assertThat(card("A").get("status")).as("never marked sold out by a failed read").isEqualTo("published");
    }

    @Test
    void feedSendsAQuantityOnlyWhenItIsKnown() throws Exception {
        sync.apply(sourceId, complete(withSizes("A",
            new ProductSize("XS", true, 5), new ProductSize("S", true, 4), new ProductSize("M", true, 1),
            new ProductSize("L", true), new ProductSize("XL", true, 0), new ProductSize("XS/S", false))));
        String id = card("A").get("id").toString();

        String json = mvc.perform(get("/api/feed")).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();

        assertThat(feedCard(json, id).get("sizes")).isEqualTo(List.of(
            Map.of("label", "XS", "available", true, "quantity", 5),
            Map.of("label", "S", "available", true, "quantity", 4),
            Map.of("label", "M", "available", true, "quantity", 1),
            Map.of("label", "L", "available", true),
            Map.of("label", "XL", "available", false, "quantity", 0),
            Map.of("label", "XS/S", "available", false)));
        assertThat(json).as("unknown is left out, never null").doesNotContain("\"quantity\":null");
    }

    static ImportedItem withSizes(String externalId, ProductSize... sizes) {
        ImportedItem base = item(externalId, 1000, true);
        return new ImportedItem(base.externalId(), base.brandName(), base.name(), base.priceUah(), base.photoUrl(),
            base.productUrl(), true, List.of(sizes), base.colors(), base.material(), base.description());
    }

    // ---------- GET /api/feed ----------

    @Test
    void importedCardIsInTheFeedWithItsDetailsAndSourceBrand() throws Exception {
        ImportedItem item = new ImportedItem("A", "Barricade", "Футболка сіра", 750,
            "https://cdn.example.com/a.jpg", "https://shop.example.com/a?id=1#top", true,
            List.of(new ProductSize("M", true), new ProductSize("L", false)),
            List.of(new ProductColor("сірий", "#9E9E9E"), new ProductColor("Пісочний", null)),
            "100% Бавовна", "Фасон: оверсайз");
        sync.apply(sourceId, complete(item));
        String id = card("A").get("id").toString();

        String json = mvc.perform(get("/api/feed")).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        Map<String, Object> card = feedCard(json, id);

        assertThat(card).containsOnlyKeys("id", "name", "brandName", "priceUah", "photoUrl", "productUrl",
            "sizes", "colors", "material", "description");
        assertThat(card.get("brandName")).isEqualTo("Barricade");
        assertThat(card.get("priceUah")).isEqualTo(750);
        assertThat(card.get("photoUrl")).isEqualTo("https://cdn.example.com/a.jpg");
        assertThat(card.get("productUrl")).as("stored as given, no UTM").isEqualTo("https://shop.example.com/a?id=1#top");
        assertThat(card.get("sizes")).isEqualTo(List.of(
            Map.of("label", "M", "available", true), Map.of("label", "L", "available", false)));
        assertThat(JsonPath.<List<Object>>read(json, "$.items[?(@.id=='" + id + "')].colors[1].hex"))
            .containsExactly((Object) null);
        assertThat(card.get("material")).isEqualTo("100% Бавовна");
        assertThat(card.get("description")).isEqualTo("Фасон: оверсайз");
    }

    @Test
    void draftImportedCardsAreNotInTheFeed() throws Exception {
        sync.apply(sourceId, complete(item("A", 1000, false)));
        String id = card("A").get("id").toString();

        String json = mvc.perform(get("/api/feed")).andReturn().getResponse().getContentAsString();

        assertThat(JsonPath.<List<Object>>read(json, "$.items[?(@.id=='" + id + "')]")).isEmpty();
    }

    @Test
    void brandCardsInTheFeedHaveOnlyThePublicCardFields() throws Exception {
        MockHttpSession brand = brandWithName("Lileya");
        String created = mvc.perform(post("/api/brand/products").with(csrf()).session(brand)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"name":"Лляна сукня","priceUah":2400,"photoImageId":null,
                     "photoUrl":"https://cdn.brand-site.ua/dress.webp","productUrl":"https://brand-site.ua/dress"}
                    """))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(created, "$.id");
        // Publishing via the API is not built yet (US-31); the feed only needs a Published row.
        jdbc.sql("UPDATE products SET status = 'published', published_at = now() WHERE id = :id")
            .param("id", UUID.fromString(id)).update();

        String json = mvc.perform(get("/api/feed")).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();

        assertThat(feedCard(json, id)).containsOnlyKeys("id", "name", "brandName", "priceUah", "photoUrl", "productUrl")
            .containsEntry("brandName", "Lileya");
    }

    @Test
    void cardsOfOneBrandKeepTheirPublishedAtOrder() throws Exception {
        sync.apply(sourceId, complete(item("A", 1000, true), item("B", 1000, true)));
        setPublishedAt(sourceId, "A", "2100-01-02T00:00:00Z");
        setPublishedAt(sourceId, "B", "2100-01-01T00:00:00Z");
        String a = card("A").get("id").toString();
        String b = card("B").get("id").toString();

        assertThat(feedIds()).filteredOn(id -> id.equals(a) || id.equals(b)).containsExactly(b, a);
    }

    @Test
    void feedMixesBrandsAndSourcesRoundByRound() throws Exception {
        // Source 1 published three cards of «Brand X», source 2 later two cards of «Brand Y».
        sync.apply(sourceId, complete(item("X1", "Brand X"), item("X2", "Brand X"), item("X3", "Brand X")));
        UUID otherSource = sync.registerSource(code + "-2", "https://" + code + "-2.example.com");
        sync.apply(otherSource, complete(item("Y1", "Brand Y"), item("Y2", "Brand Y")));
        setPublishedAt(sourceId, "X1", "2100-01-01T00:00:00Z");
        setPublishedAt(sourceId, "X2", "2100-01-02T00:00:00Z");
        setPublishedAt(sourceId, "X3", "2100-01-03T00:00:00Z");
        setPublishedAt(otherSource, "Y1", "2100-01-04T00:00:00Z");
        setPublishedAt(otherSource, "Y2", "2100-01-05T00:00:00Z");
        Map<String, String> names = Map.of(
            id(sourceId, "X1"), "X1", id(sourceId, "X2"), "X2", id(sourceId, "X3"), "X3",
            id(otherSource, "Y1"), "Y1", id(otherSource, "Y2"), "Y2");

        List<String> order = feedIds().stream().filter(names::containsKey).map(names::get).toList();

        assertThat(order).hasSize(5);
        assertThat(order.subList(0, 2)).as("round 1: the first card of each brand").containsExactlyInAnyOrder("X1", "Y1");
        assertThat(order.subList(2, 4)).as("round 2, brands in the same order as in round 1")
            .containsExactly(order.get(0).replace('1', '2'), order.get(1).replace('1', '2'));
        assertThat(order.get(4)).isEqualTo("X3");
        assertThat(feedIds()).as("stable between requests").isEqualTo(feedIds());
    }

    // ---------- T-17 and schema checks ----------

    @Test
    void brandCabinetNeverListsImportedCards() throws Exception {
        sync.apply(sourceId, complete(item("A", 1000, true)));
        MockHttpSession brand = brandWithName("Cabinet Brand");

        mvc.perform(get("/api/brand/products").session(brand))
            .andExpect(status().isOk())
            .andExpect(content().json("[]"));
    }

    @Test
    void schemaRejectsACardWithTwoOwnersOrAnImportedCardWithoutPhotoUrl() throws Exception {
        sync.apply(sourceId, complete(item("A", 1000, true)));
        UUID brandId = registeredBrandId();

        assertThatThrownBy(() -> jdbc.sql("UPDATE products SET brand_id = :b WHERE source_id = :s")
                .param("b", brandId).param("s", sourceId).update())
            .as("products_one_owner").isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.sql("UPDATE products SET external_id = NULL WHERE source_id = :s")
                .param("s", sourceId).update())
            .as("products_import_columns").isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.sql("UPDATE products SET sizes = '{}'::jsonb WHERE source_id = :s")
                .param("s", sourceId).update())
            .as("products_sizes_array").isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void networkPartOfTheImportDoesNotExistInTests() {
        assertThat(context.getBeanNamesForType(CatalogImportJob.class)).isEmpty();
    }

    // ---------- helpers ----------

    static ImportBatch complete(ImportedItem... items) {
        return new ImportBatch(List.of(items), true);
    }

    static ImportedItem item(String externalId, int price, boolean available) {
        return new ImportedItem(externalId, "Test Brand", "Товар " + externalId, price,
            "https://cdn.example.com/" + externalId + ".jpg", "https://shop.example.com/" + externalId, available,
            List.of(new ProductSize("M", available)), List.of(new ProductColor("чорний", "#1A1A1A")), null,
            "Опис " + externalId);
    }

    static ImportedItem item(String externalId, String brandName) {
        ImportedItem base = item(externalId, 1000, true);
        return new ImportedItem(base.externalId(), brandName, base.name(), base.priceUah(), base.photoUrl(),
            base.productUrl(), base.available(), base.sizes(), base.colors(), base.material(), base.description());
    }

    void setPublishedAt(UUID source, String externalId, String timestamp) {
        jdbc.sql("UPDATE products SET published_at = :t WHERE source_id = :s AND external_id = :e")
            .param("t", OffsetDateTime.parse(timestamp)).param("s", source).param("e", externalId).update();
    }

    String id(UUID source, String externalId) {
        return jdbc.sql("SELECT id FROM products WHERE source_id = :s AND external_id = :e")
            .param("s", source).param("e", externalId).query(UUID.class).single().toString();
    }

    List<String> feedIds() throws Exception {
        String json = mvc.perform(get("/api/feed")).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return JsonPath.read(json, "$.items[*].id");
    }

    List<Map<String, Object>> rows() {
        return jdbc.sql("SELECT * FROM products WHERE source_id = :s").param("s", sourceId).query().listOfRows();
    }

    Map<String, Object> card(String externalId) {
        return jdbc.sql("SELECT * FROM products WHERE source_id = :s AND external_id = :e")
            .param("s", sourceId).param("e", externalId).query().singleRow();
    }

    static Map<String, Object> feedCard(String json, String id) {
        List<Map<String, Object>> cards = JsonPath.read(json, "$.items[?(@.id=='" + id + "')]");
        assertThat(cards).hasSize(1);
        return cards.getFirst();
    }

    MockHttpSession brandWithName(String name) throws Exception {
        var result = mvc.perform(post("/api/brand/register").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"brand-" + UUID.randomUUID() + "@example.com\",\"password\":\"secret-123\",\"contactName\":\"Olena\",\"name\":\"Test Brand\",\"websiteUrl\":\"https://brand.example.com\"}"))
            .andExpect(status().isCreated())
            .andReturn();
        MockHttpSession session = (MockHttpSession) result.getRequest().getSession(false);
        mvc.perform(put("/api/brand/profile").with(csrf()).session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"" + name + "\",\"logoImageId\":null,\"logoUrl\":null,\"consentGiven\":false}"))
            .andExpect(status().isOk());
        return session;
    }

    UUID registeredBrandId() throws Exception {
        String body = mvc.perform(post("/api/brand/register").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"brand-" + UUID.randomUUID() + "@example.com\",\"password\":\"secret-123\",\"contactName\":\"Olena\",\"name\":\"Test Brand\",\"websiteUrl\":\"https://brand.example.com\"}"))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        return UUID.fromString(JsonPath.read(body, "$.brandId"));
    }

    OffsetDateTime publishedAt(String externalId) {
        return jdbc.sql("SELECT published_at FROM products WHERE source_id = :s AND external_id = :e")
            .param("s", sourceId).param("e", externalId).query(OffsetDateTime.class).optional().orElse(null);
    }
}
