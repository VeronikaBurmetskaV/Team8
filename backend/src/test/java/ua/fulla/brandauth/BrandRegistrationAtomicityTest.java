package ua.fulla.brandauth;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import ua.fulla.brandprofile.BrandProfileService;

/** T-9: the account and its empty profile are created together or not at all. */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class BrandRegistrationAtomicityTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcClient jdbc;

    @MockitoSpyBean
    BrandProfileService profiles;

    @Test
    void accountIsRolledBackWhenTheProfileCannotBeCreated() throws Exception {
        String email = "brand-" + UUID.randomUUID() + "@example.com";
        doThrow(new IllegalStateException("profile insert failed (test)")).when(profiles).createEmpty(any());

        mvc.perform(post("/api/brand/register").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"secret-123\"}"))
            .andExpect(status().isInternalServerError());

        Integer accounts = jdbc.sql("SELECT count(*) FROM brand_accounts WHERE email = :email")
            .param("email", email).query(Integer.class).single();
        assertThat(accounts).isZero();
    }
}
