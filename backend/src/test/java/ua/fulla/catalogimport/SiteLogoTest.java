package ua.fulla.catalogimport;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import org.junit.jupiter.api.Test;

/** Finding the source site's logo on its home page (ADR-0015). No network. */
class SiteLogoTest {

    private static final URI HOME = URI.create("https://shop.example.com/");

    private static String page(String head) {
        return "<html><head>" + head + "</head><body></body></html>";
    }

    @Test
    void jsonLdOrganizationLogoComesFirst() {
        String html = page("""
            <link rel="apple-touch-icon" href="/apple.png">
            <meta property="og:image" content="https://shop.example.com/og.jpg">
            <script type="application/ld+json">
              {"@context":"https://schema.org","@graph":[
                {"@type":"WebSite","name":"Shop"},
                {"@type":"Organization","logo":{"@type":"ImageObject","url":"/img/logo.svg"}}]}
            </script>""");
        assertThat(SiteLogo.find(html, HOME)).isEqualTo("https://shop.example.com/img/logo.svg");
    }

    @Test
    void thenAppleTouchIconThenOgImageThenFavicon() {
        String all = """
            <link rel="icon" href="/favicon-32.png">
            <meta property="og:image" content="https://cdn.example.com/og.jpg">
            <link rel="apple-touch-icon" sizes="180x180" href="/apple.png">""";
        assertThat(SiteLogo.find(page(all), HOME)).isEqualTo("https://shop.example.com/apple.png");

        String noApple = """
            <link rel="shortcut icon" href="/favicon-32.png">
            <meta property="og:image" content="https://cdn.example.com/og.jpg">""";
        assertThat(SiteLogo.find(page(noApple), HOME)).isEqualTo("https://cdn.example.com/og.jpg");

        assertThat(SiteLogo.find(page("<link rel=\"shortcut icon\" href=\"//cdn.example.com/f.ico\">"), HOME))
            .isEqualTo("https://cdn.example.com/f.ico");
        assertThat(SiteLogo.find(page(""), HOME)).isEqualTo("https://shop.example.com/favicon.ico");
    }

    @Test
    void onlyHttpsUrlsAreKept() {
        String html = page("""
            <script type="application/ld+json">{"@type":"Organization","logo":"http://shop.example.com/logo.png"}</script>
            <link rel="apple-touch-icon" href="data:image/png;base64,AAAA">
            <meta property="og:image" content="javascript:alert(1)">
            <link rel="icon" href="https://shop.example.com/icon.png">""");
        assertThat(SiteLogo.find(html, HOME)).isEqualTo("https://shop.example.com/icon.png");
    }

    @Test
    void brokenJsonLdDoesNotHideTheNextCandidate() {
        String html = page("""
            <script type="application/ld+json">{ broken </script>
            <link rel="apple-touch-icon-precomposed" href="/apple.png">""");
        assertThat(SiteLogo.find(html, HOME)).isEqualTo("https://shop.example.com/apple.png");
    }
}
