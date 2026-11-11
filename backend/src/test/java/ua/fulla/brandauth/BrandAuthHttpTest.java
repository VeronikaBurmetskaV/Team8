package ua.fulla.brandauth;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import java.net.CookieManager;
import java.net.HttpCookie;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpRequest.BodyPublishers;
import java.net.http.HttpResponse;
import java.net.http.HttpResponse.BodyHandlers;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;

/**
 * The same flow as the curl example of the PR, over real HTTP: MockMvc has no servlet container,
 * so only here we can see the FULLA_SESSION cookie and the XSRF-TOKEN cookie → X-XSRF-TOKEN header.
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class BrandAuthHttpTest {

    @Value("${local.server.port}")
    int port;

    final CookieManager cookies = new CookieManager();
    final HttpClient http = HttpClient.newBuilder().cookieHandler(cookies).build();

    @Test
    void registerProfileLogoutOverRealHttp() throws Exception {
        String email = "brand-" + UUID.randomUUID() + "@example.com";
        String credentials = "{\"email\":\"" + email + "\",\"password\":\"secret-123\"}";

        // 1. GET /api/session hands out the CSRF cookie
        assertThat(send(request("/api/session").GET()).body())
            .isEqualTo("{\"accountType\":null,\"email\":null}");
        assertThat(cookie("XSRF-TOKEN")).isNotNull();

        // 2. a POST without the header is refused
        HttpResponse<String> noToken = send(request("/api/brand/register").POST(BodyPublishers.ofString(credentials)));
        assertThat(noToken.statusCode()).isEqualTo(403);
        assertThat(noToken.body()).contains("\"code\":\"FORBIDDEN\"");

        // 3. register with the header → 201 and the session cookie
        HttpResponse<String> registered = send(withCsrf(request("/api/brand/register"))
            .POST(BodyPublishers.ofString(credentials)));
        assertThat(registered.statusCode()).isEqualTo(201);
        assertThat(registered.body()).contains("\"profileState\":\"INCOMPLETE\"");
        String setCookie = String.join("\n", registered.headers().allValues("Set-Cookie"));
        assertThat(setCookie).contains("FULLA_SESSION=").contains("HttpOnly").contains("SameSite=Lax");

        // 4. the cookie opens the cabinet
        assertThat(send(request("/api/brand/profile").GET()).statusCode()).isEqualTo(200);
        HttpResponse<String> saved = send(withCsrf(request("/api/brand/profile"))
            .PUT(BodyPublishers.ofString("{\"name\":\"Lileya\",\"logoImageId\":null,\"logoUrl\":null,\"consentGiven\":false}")));
        assertThat(saved.statusCode()).isEqualTo(200);
        assertThat(saved.body()).contains("\"state\":\"ACTIVE\"");
        assertThat(send(request("/api/session").GET()).body()).contains("\"accountType\":\"BRAND\"");

        // 5. logout → 204, the cabinet is closed again
        assertThat(send(withCsrf(request("/api/brand/logout")).POST(BodyPublishers.noBody())).statusCode())
            .isEqualTo(204);
        HttpResponse<String> afterLogout = send(request("/api/brand/profile").GET());
        assertThat(afterLogout.statusCode()).isEqualTo(401);
        assertThat(afterLogout.body()).contains("\"code\":\"UNAUTHENTICATED\"");

        // 6. login again with the same credentials
        HttpResponse<String> loggedIn = send(withCsrf(request("/api/brand/login"))
            .POST(BodyPublishers.ofString(credentials)));
        assertThat(loggedIn.statusCode()).isEqualTo(200);
        assertThat(loggedIn.body()).contains("\"profileState\":\"ACTIVE\"");
        assertThat(send(request("/api/brand/profile").GET()).statusCode()).isEqualTo(200);
    }

    private HttpRequest.Builder request(String path) {
        return HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
            .header("Content-Type", "application/json");
    }

    /** What frontend/src/api/client.ts does: copy the XSRF-TOKEN cookie into the header. */
    private HttpRequest.Builder withCsrf(HttpRequest.Builder builder) {
        return builder.header("X-XSRF-TOKEN", cookie("XSRF-TOKEN"));
    }

    private HttpResponse<String> send(HttpRequest.Builder builder) throws Exception {
        return http.send(builder.build(), BodyHandlers.ofString());
    }

    private String cookie(String name) {
        return cookies.getCookieStore().getCookies().stream()
            .filter(c -> c.getName().equals(name))
            .map(HttpCookie::getValue)
            .findFirst().orElse(null);
    }
}
