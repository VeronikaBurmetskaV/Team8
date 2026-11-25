package ua.fulla.catalogimport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.net.InetAddress;
import java.net.UnknownHostException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** The SSRF guards of the shared fetcher for brand sites (ADR-0017). No real network. */
class SiteFetcherSafetyTest {

    final FakeWeb web = new FakeWeb();

    // ---------- private and special addresses ----------

    @ParameterizedTest
    @ValueSource(strings = {
        "127.0.0.1", "127.8.8.8", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.10", "169.254.169.254",
        "100.64.0.1", "0.0.0.0", "224.0.0.1", "240.0.0.1", "255.255.255.255", "192.0.2.10", "198.18.0.1",
        "::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "2001:db8::1", "::ffff:127.0.0.1",
        "::ffff:10.0.0.1", "64:ff9b::a00:1", "2002:a00:1::1"})
    void nonPublicAddressesAreRefused(String ip) throws UnknownHostException {
        assertThat(AddressGuard.isPublic(InetAddress.getByName(ip))).as(ip).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"93.184.216.34", "8.8.8.8", "172.32.0.1", "100.128.0.1", "2a00:1450:4001::64",
        "64:ff9b::808:808"})
    void publicAddressesAreAllowed(String ip) throws UnknownHostException {
        assertThat(AddressGuard.isPublic(InetAddress.getByName(ip))).as(ip).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"10.0.0.5", "127.0.0.1", "169.254.169.254", "::1", "fd00::5"})
    void hostResolvingToAPrivateAddressIsNeverContacted(String ip) {
        web.dns("brand.ua", ip).page("https://brand.ua/robots.txt", "text/plain", "");
        PoliteFetcher fetcher = web.fetcher("brand.ua", 10);

        assertThatThrownBy(fetcher::loadRobots).isInstanceOf(SourceStoppedException.class)
            .hasCauseInstanceOf(UnsafeUrlException.class);
        assertThat(web.requests()).isEmpty();
    }

    @Test
    void oneNonPublicAddressAmongSeveralIsEnough() {
        web.dns("brand.ua", "93.184.216.34", "10.0.0.5");
        PoliteFetcher fetcher = web.fetcher("brand.ua", 10);

        assertThatThrownBy(fetcher::loadRobots).hasCauseInstanceOf(UnsafeUrlException.class);
        assertThat(web.requests()).isEmpty();
    }

    @Test
    void redirectToAPrivateAddressIsRefusedBeforeItIsFollowed() throws IOException {
        web.redirect("https://brand.ua/shop", "https://internal.brand.ua/admin").dns("internal.brand.ua", "192.168.0.10");
        PoliteFetcher fetcher = robotsLoaded();

        assertThatThrownBy(() -> fetcher.getText("https://brand.ua/shop", 1000))
            .isInstanceOf(UnsafeUrlException.class);
        assertThat(web.requestedUrls()).doesNotContain("https://internal.brand.ua/admin");
    }

    // ---------- scheme, port, domain ----------

    @Test
    void httpIsRefused() throws IOException {
        PoliteFetcher fetcher = robotsLoaded();

        assertThatThrownBy(() -> fetcher.getText("http://brand.ua/", 1000)).isInstanceOf(UnsafeUrlException.class);
    }

    @Test
    void redirectToHttpIsRefused() throws IOException {
        web.redirect("https://brand.ua/a", "http://brand.ua/a");
        PoliteFetcher fetcher = robotsLoaded();

        assertThatThrownBy(() -> fetcher.getText("https://brand.ua/a", 1000)).isInstanceOf(UnsafeUrlException.class);
        assertThat(web.requestedUrls()).doesNotContain("http://brand.ua/a");
    }

    @Test
    void anotherDomainIsRefusedAlsoAfterARedirect() throws IOException {
        web.redirect("https://brand.ua/go", "https://evil.example/steal");
        PoliteFetcher fetcher = robotsLoaded();

        assertThatThrownBy(() -> fetcher.getText("https://evil.example/", 1000)).isInstanceOf(UnsafeUrlException.class);
        assertThatThrownBy(() -> fetcher.getText("https://brand.ua.evil.example/", 1000))
            .isInstanceOf(UnsafeUrlException.class);
        assertThatThrownBy(() -> fetcher.getText("https://notbrand.ua/", 1000)).isInstanceOf(UnsafeUrlException.class);
        assertThatThrownBy(() -> fetcher.getText("https://brand.ua/go", 1000)).isInstanceOf(UnsafeUrlException.class);
        assertThat(web.requestedUrls()).noneMatch(url -> url.contains("evil") || url.contains("notbrand"));
    }

    @Test
    void otherPortsAndUserInfoAreRefused() throws IOException {
        PoliteFetcher fetcher = robotsLoaded();

        assertThatThrownBy(() -> fetcher.getText("https://brand.ua:8443/", 1000)).isInstanceOf(UnsafeUrlException.class);
        assertThatThrownBy(() -> fetcher.getText("https://user@brand.ua/", 1000)).isInstanceOf(UnsafeUrlException.class);
        assertThatThrownBy(() -> fetcher.getText("https://brand.ua@10.0.0.1/", 1000))
            .isInstanceOf(UnsafeUrlException.class);
    }

    @Test
    void subdomainsOfTheVerifiedDomainArePublicAndAllowed() throws IOException {
        web.redirect("https://brand.ua/", "https://www.brand.ua/").html("https://www.brand.ua/", "<p>hi</p>");
        PoliteFetcher fetcher = robotsLoaded();

        assertThat(fetcher.getText("https://brand.ua/", 1000)).isEqualTo("<p>hi</p>");
        // An explicit :443 is allowed (the fake web has no page there: 404 → null, no exception).
        assertThat(fetcher.getText("https://brand.ua:443/", 1000)).isNull();
    }

    @Test
    void atMostThreeRedirects() throws IOException {
        web.redirect("https://brand.ua/1", "/2").redirect("https://brand.ua/2", "/3")
            .redirect("https://brand.ua/3", "/4").redirect("https://brand.ua/4", "/5");
        PoliteFetcher fetcher = robotsLoaded();

        assertThatThrownBy(() -> fetcher.getText("https://brand.ua/1", 1000)).hasMessageContaining("Too many redirects");
    }

    // ---------- content type, size, User-Agent, robots, request cap ----------

    @Test
    void onlyAllowedContentTypesAreRead() throws IOException {
        web.page("https://brand.ua/image", "image/png", "PNG").page("https://brand.ua/none", "", "x");
        PoliteFetcher fetcher = robotsLoaded();

        assertThatThrownBy(() -> fetcher.getText("https://brand.ua/image", 1000)).hasMessageContaining("image/png");
        assertThatThrownBy(() -> fetcher.getText("https://brand.ua/none", 1000)).hasMessageContaining("Content-Type");
    }

    @Test
    void bodyLargerThanTheCapIsRefused() throws IOException {
        web.html("https://brand.ua/big", "x".repeat(2000));
        PoliteFetcher fetcher = robotsLoaded();

        assertThatThrownBy(() -> fetcher.getText("https://brand.ua/big", 1000)).hasMessageContaining("larger than");
    }

    @Test
    void userAgentNamesTheBotAndItsPage() throws IOException {
        robotsLoaded();

        assertThat(web.requests().get(0).headers().firstValue("User-Agent"))
            .hasValue("FULLA-bot/1.0 (+https://fulla.example/bot)");
    }

    @Test
    void robotsTxtForFullaBotIsRespected() throws IOException {
        web.page("https://brand.ua/robots.txt", "text/plain", "User-agent: FULLA-bot\nDisallow: /private\n")
            .html("https://brand.ua/private/x", "secret");
        PoliteFetcher fetcher = web.fetcher("brand.ua", 10);
        fetcher.loadRobots();

        assertThat(fetcher.getText("https://brand.ua/private/x", 1000)).isNull();
        assertThat(fetcher.robotsBlocked()).isEqualTo(1);
        assertThat(web.requestedUrls()).doesNotContain("https://brand.ua/private/x");
    }

    @Test
    void requestCapStopsTheRun() throws IOException {
        web.html("https://brand.ua/a", "a");
        PoliteFetcher fetcher = web.fetcher("brand.ua", 2);
        fetcher.loadRobots();
        fetcher.getText("https://brand.ua/a", 1000);

        assertThatThrownBy(() -> fetcher.getText("https://brand.ua/a", 1000)).hasMessageContaining("Request cap");
    }

    private PoliteFetcher robotsLoaded() throws IOException {
        PoliteFetcher fetcher = web.fetcher("brand.ua", 20);
        fetcher.loadRobots(); // 404: everything allowed
        return fetcher;
    }
}
