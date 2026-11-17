package ua.fulla.catalogimport;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** robots.txt rules in the formats of the three sources (ADR-0014). */
class RobotsRulesTest {

    static final String AGENT = PoliteFetcher.AGENT_TOKEN;

    @Test
    void vsiSvoiAllowsTheFeedAndBlocksSearchAndTracking() {
        RobotsRules rules = RobotsRules.parse("""
            # robots.txt - vsisvoi.ua
            User-agent: *

            Allow: /facebook-feed.xml
            Disallow: /search
            Disallow: /*?sort=*
            Disallow: /*utm_source*
            Disallow: /member/
            """, AGENT);

        assertThat(rules.isAllowed("/facebook-feed.xml")).isTrue();
        assertThat(rules.isAllowed("/store/sukniia-p-1")).isTrue();
        assertThat(rules.isAllowed("/search?q=x")).isFalse();
        assertThat(rules.isAllowed("/store/a?sort=price")).isFalse();
        assertThat(rules.isAllowed("/store/a?utm_source=fulla")).isFalse();
        assertThat(rules.isAllowed("/member/orders")).isFalse();
    }

    @Test
    void oneByOneBlocksPaginationButAllowsProducts() {
        RobotsRules rules = RobotsRules.parse("""
            User-agent: *
            Allow: /
            Disallow: *search*
            Disallow: /*?page=
            Disallow: /en/*
            """, AGENT);

        assertThat(rules.isAllowed("/suknja-atlasna")).isTrue();
        assertThat(rules.isAllowed("/wardrobe?page=2")).isFalse();
        assertThat(rules.isAllowed("/en/dress")).isFalse();
        assertThat(rules.isAllowed("/product/search")).isFalse();
        assertThat(rules.isAllowed("/sitemap.xml")).isTrue();
    }

    @Test
    void cher17BlocksCartAndPricePaths() {
        RobotsRules rules = RobotsRules.parse("""
            User-agent: *

            Disallow: */cart
            Disallow: */price
            """, AGENT);

        assertThat(rules.isAllowed("/product/puhovik")).isTrue();
        assertThat(rules.isAllowed("/cart")).isFalse();
        assertThat(rules.isAllowed("/product-category/sukni/price")).isFalse();
    }

    @Test
    void longestMatchWinsAndATieGoesToAllow() {
        RobotsRules rules = RobotsRules.parse("""
            User-agent: *
            Disallow: /shop
            Allow: /shop/item
            Disallow: /a$
            Allow: /x
            Disallow: /x
            """, AGENT);

        assertThat(rules.isAllowed("/shop/cart")).isFalse();
        assertThat(rules.isAllowed("/shop/item/1")).isTrue();
        assertThat(rules.isAllowed("/a")).isFalse();
        assertThat(rules.isAllowed("/ab")).isTrue();
        assertThat(rules.isAllowed("/x")).isTrue();
    }

    @Test
    void ourOwnGroupReplacesTheStarGroup() {
        RobotsRules rules = RobotsRules.parse("""
            User-agent: *
            Disallow: /

            User-agent: FULLA-demo-importer
            Disallow: /private
            """, AGENT);

        assertThat(rules.isAllowed("/product/a")).isTrue();
        assertThat(rules.isAllowed("/private/a")).isFalse();
    }

    @Test
    void emptyDisallowAndMissingFileAllowEverything() {
        assertThat(RobotsRules.parse("User-agent: *\nDisallow:\n", AGENT).isAllowed("/anything")).isTrue();
        assertThat(RobotsRules.allowAll().isAllowed("/anything")).isTrue();
    }
}
