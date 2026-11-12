package ua.fulla.images;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static ua.fulla.images.ImageServiceTest.bytes;

import com.jayway.jsonpath.JsonPath;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
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
import ua.fulla.common.SessionAccount;
import ua.fulla.common.SessionAccount.AccountType;

/** POST /api/images and GET /api/images/{id} (ADR-0007, Q-03). The 5 MB multipart limit is in ImageUploadHttpTest. */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class ImageTest {

    static final byte[] PNG = bytes(0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0x0D, 'I', 'H', 'D', 'R');
    static final byte[] JPEG = bytes(0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10, 'J', 'F', 'I', 'F', 0);
    static final byte[] WEBP = bytes('R', 'I', 'F', 'F', 0x24, 0, 0, 0, 'W', 'E', 'B', 'P', 'V', 'P', '8', ' ');

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcClient jdbc;

    @Test
    void uploadedPngIsServedWithItsTypeAndImmutableCaching() throws Exception {
        String email = uniqueEmail();
        MockHttpSession session = registerBrand(email);

        String body = upload(session, new MockMultipartFile("file", "photo.png", "image/png", PNG))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$.id").isString())
            .andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(body, "$.id");
        assertThat((String) JsonPath.read(body, "$.url")).isEqualTo("/api/images/" + id);

        // public: no session needed, so <img> works in the feed and «Вподобане»
        mvc.perform(get("/api/images/" + id))
            .andExpect(status().isOk())
            .andExpect(content().contentType("image/png"))
            .andExpect(content().bytes(PNG))
            .andExpect(header().stringValues("X-Content-Type-Options", "nosniff"))
            .andExpect(header().stringValues("Cache-Control", "public, max-age=31536000, immutable"))
            .andExpect(header().doesNotExist("Pragma"))
            .andExpect(header().doesNotExist("Expires"));

        // the row records who uploaded it (Q-03)
        String uploadedBy = jdbc.sql("""
                SELECT a.email FROM images i JOIN brand_accounts a ON a.id = i.uploaded_by WHERE i.id = :id
                """)
            .param("id", UUID.fromString(id)).query(String.class).single();
        assertThat(uploadedBy).isEqualTo(email);
    }

    @Test
    void typeComesFromMagicBytesNotFromFileNameOrContentType() throws Exception {
        MockHttpSession session = registerBrand(uniqueEmail());

        String jpegId = uploadedId(session, new MockMultipartFile("file", "photo.png", "image/png", JPEG));
        mvc.perform(get("/api/images/" + jpegId))
            .andExpect(status().isOk())
            .andExpect(content().contentType("image/jpeg"))
            .andExpect(content().bytes(JPEG));

        String webpId = uploadedId(session, new MockMultipartFile("file", "photo", "application/octet-stream", WEBP));
        mvc.perform(get("/api/images/" + webpId))
            .andExpect(status().isOk())
            .andExpect(content().contentType("image/webp"))
            .andExpect(content().bytes(WEBP));
    }

    @Test
    void fileOfExactlyFiveMegabytesIsAccepted() throws Exception {
        MockHttpSession session = registerBrand(uniqueEmail());

        byte[] largest = Arrays.copyOf(PNG, ImageService.MAX_BYTES);
        upload(session, new MockMultipartFile("file", "big.png", "image/png", largest))
            .andExpect(status().isCreated());
    }

    @Test
    void anythingButPngJpegWebpUpToFiveMegabytesIsImageInvalid() throws Exception {
        MockHttpSession session = registerBrand(uniqueEmail());
        byte[] svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>"
            .getBytes(StandardCharsets.UTF_8);

        List<MockMultipartFile> invalid = List.of(
            new MockMultipartFile("file", "logo.svg", "image/svg+xml", svg),
            // an SVG in disguise: the name and the client's type say PNG
            new MockMultipartFile("file", "logo.png", "image/png", svg),
            new MockMultipartFile("file", "notes.txt", "text/plain", "сукня".getBytes(StandardCharsets.UTF_8)),
            new MockMultipartFile("file", "anim.gif", "image/gif", "GIF89a....".getBytes(StandardCharsets.US_ASCII)),
            new MockMultipartFile("file", "doc.pdf", "application/pdf", "%PDF-1.7".getBytes(StandardCharsets.US_ASCII)),
            new MockMultipartFile("file", "empty.png", "image/png", new byte[0]),
            new MockMultipartFile("file", "cut.png", "image/png", bytes(0x89, 'P', 'N')),
            // one byte over 5 MB; MockMvc skips the multipart limit, so this reaches ImageService
            new MockMultipartFile("file", "huge.png", "image/png", Arrays.copyOf(PNG, ImageService.MAX_BYTES + 1)));
        for (MockMultipartFile file : invalid) {
            expectError(upload(session, file), 400, "IMAGE_INVALID");
        }

        assertThat(jdbc.sql("SELECT count(*) FROM images WHERE size_bytes > :max OR content_type NOT LIKE 'image/%'")
            .param("max", ImageService.MAX_BYTES).query(Long.class).single()).isZero();
    }

    @Test
    void requestWithoutTheFilePartIsImageInvalid() throws Exception {
        MockHttpSession session = registerBrand(uniqueEmail());

        expectError(upload(session, new MockMultipartFile("photo", "photo.png", "image/png", PNG)), 400, "IMAGE_INVALID");
    }

    @Test
    void unknownImageIsNotFoundAndMalformedIdIsValidationFailed() throws Exception {
        expectError(mvc.perform(get("/api/images/" + UUID.randomUUID())), 404, "NOT_FOUND");
        expectError(mvc.perform(get("/api/images/not-a-uuid")), 400, "VALIDATION_FAILED");
    }

    @Test
    void uploadRequiresABrandSession() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "photo.png", "image/png", PNG);

        expectError(mvc.perform(multipart("/api/images").file(file).with(csrf())), 401, "UNAUTHENTICATED");

        var buyer = new SessionAccount(AccountType.BUYER, UUID.randomUUID(), "buyer@example.com");
        var authentication = UsernamePasswordAuthenticationToken.authenticated(
            buyer, null, List.of(new SimpleGrantedAuthority("ROLE_BUYER")));
        expectError(mvc.perform(multipart("/api/images").file(file).with(csrf())
                .with(SecurityMockMvcRequestPostProcessors.authentication(authentication))),
            403, "FORBIDDEN");
    }

    @Test
    void uploadWithoutCsrfTokenIsForbidden() throws Exception {
        MockHttpSession session = registerBrand(uniqueEmail());

        expectError(mvc.perform(multipart("/api/images")
                .file(new MockMultipartFile("file", "photo.png", "image/png", PNG)).session(session)),
            403, "FORBIDDEN");
    }

    // ---------- helpers ----------

    private ResultActions upload(MockHttpSession session, MockMultipartFile file) throws Exception {
        return mvc.perform(multipart("/api/images").file(file).with(csrf()).session(session));
    }

    private String uploadedId(MockHttpSession session, MockMultipartFile file) throws Exception {
        String body = upload(session, file).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    /** The single error envelope: { "error": { "code", "message" } }, no fields for image errors. */
    private static void expectError(ResultActions actions, int status, String code) throws Exception {
        actions
            .andExpect(status().is(status))
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$.error.code").value(code))
            .andExpect(jsonPath("$.error.message").isString())
            .andExpect(jsonPath("$.error.fields").doesNotExist());
    }

    private MockHttpSession registerBrand(String email) throws Exception {
        return (MockHttpSession) mvc.perform(post("/api/brand/register").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"secret-123\"}"))
            .andExpect(status().isCreated())
            .andReturn().getRequest().getSession(false);
    }

    private static String uniqueEmail() {
        return "brand-" + UUID.randomUUID() + "@example.com";
    }
}
