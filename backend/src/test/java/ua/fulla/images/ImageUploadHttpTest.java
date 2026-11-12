package ua.fulla.images;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import java.io.ByteArrayOutputStream;
import java.net.CookieManager;
import java.net.HttpCookie;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpRequest.BodyPublishers;
import java.net.http.HttpResponse;
import java.net.http.HttpResponse.BodyHandlers;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;

/**
 * The multipart size limit (spring.servlet.multipart.max-file-size = 5MB) over real HTTP:
 * MockMvc does not parse multipart bodies, so only here a too large file is refused by the
 * servlet container and must still come back as 400 IMAGE_INVALID in the error envelope.
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class ImageUploadHttpTest {

    @Value("${local.server.port}")
    int port;

    final CookieManager cookies = new CookieManager();
    final HttpClient http = HttpClient.newBuilder().cookieHandler(cookies).build();

    @Test
    void fiveMegabytesAreAcceptedAndOneByteMoreIsImageInvalid() throws Exception {
        registerBrand();

        HttpResponse<String> largest = uploadPng(ImageService.MAX_BYTES);
        assertThat(largest.statusCode()).isEqualTo(201);
        assertThat(largest.body()).contains("\"url\":\"/api/images/");

        HttpResponse<String> tooLarge = uploadPng(ImageService.MAX_BYTES + 1);
        assertThat(tooLarge.statusCode()).isEqualTo(400);
        assertThat(tooLarge.headers().firstValue("Content-Type")).hasValueSatisfying(
            type -> assertThat(type).startsWith("application/json"));
        assertThat(tooLarge.body()).startsWith("{\"error\":{\"code\":\"IMAGE_INVALID\",\"message\":");
    }

    private void registerBrand() throws Exception {
        // GET /api/session hands out the XSRF-TOKEN cookie, as in the SPA
        send(request("/api/session").GET());
        String credentials = "{\"email\":\"brand-" + UUID.randomUUID() + "@example.com\",\"password\":\"secret-123\"}";
        HttpResponse<String> registered = send(withCsrf(request("/api/brand/register"))
            .header("Content-Type", "application/json")
            .POST(BodyPublishers.ofString(credentials)));
        assertThat(registered.statusCode()).isEqualTo(201);
    }

    /** A multipart body with one part "file": a PNG signature padded with zeros to {@code size} bytes. */
    private HttpResponse<String> uploadPng(int size) throws Exception {
        byte[] png = Arrays.copyOf(ImageTest.PNG, size);
        String boundary = "fulla-" + UUID.randomUUID();
        var body = new ByteArrayOutputStream();
        body.writeBytes(("--" + boundary + "\r\n"
            + "Content-Disposition: form-data; name=\"file\"; filename=\"photo.png\"\r\n"
            + "Content-Type: image/png\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
        body.writeBytes(png);
        body.writeBytes(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.US_ASCII));

        return send(withCsrf(request("/api/images"))
            .header("Content-Type", "multipart/form-data; boundary=" + boundary)
            .POST(BodyPublishers.ofByteArray(body.toByteArray())));
    }

    private HttpRequest.Builder request(String path) {
        return HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
    }

    /** What frontend/src/api/client.ts does: copy the XSRF-TOKEN cookie into the header. */
    private HttpRequest.Builder withCsrf(HttpRequest.Builder builder) {
        String token = cookies.getCookieStore().getCookies().stream()
            .filter(c -> c.getName().equals("XSRF-TOKEN"))
            .map(HttpCookie::getValue)
            .findFirst().orElseThrow();
        return builder.header("X-XSRF-TOKEN", token);
    }

    private HttpResponse<String> send(HttpRequest.Builder builder) throws Exception {
        return http.send(builder.build(), BodyHandlers.ofString());
    }
}
