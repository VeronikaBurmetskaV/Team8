package ua.fulla.catalogimport;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;
import java.util.Properties;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mock.env.MockEnvironment;

/** Who needs the ownership check (ADR-0017): everybody, except demo mode outside prod/ops. */
class SiteVerificationPolicyTest {

    @Test
    void requiredWhenNotConfigured() {
        assertThat(properties(null).siteVerificationRequired()).isTrue();
        assertThat(policy(null).required()).isTrue();
    }

    @Test
    void demoModeOnlyWhenTurnedOff() {
        assertThat(policy(true).required()).isTrue();
        assertThat(policy(false).required()).isFalse();
        assertThat(policy(false, "dev").required()).isFalse();
    }

    @Test
    void prodAndOpsAlwaysRequireItWhateverTheSetting() {
        assertThat(policy(false, "prod").required()).isTrue();
        assertThat(policy(false, "ops").required()).isTrue();
        assertThat(policy(false, "dev", "prod").required()).isTrue();
    }

    @Test
    void onlyTheDevConfigTurnsTheCheckOff() {
        assertThat(yaml("application.yml").getProperty("fulla.brand-import.require-site-verification"))
            .hasToString("true");
        assertThat(yaml("application-dev.yml").getProperty("fulla.brand-import.require-site-verification"))
            .hasToString("false");
    }

    private static Properties yaml(String name) {
        YamlPropertiesFactoryBean factory = new YamlPropertiesFactoryBean();
        factory.setResources(new ClassPathResource(name));
        Properties properties = factory.getObject();
        if (properties == null) {
            throw new IllegalStateException("No " + name);
        }
        return properties;
    }

    private static SiteVerificationPolicy policy(Boolean require, String... profiles) {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles(profiles);
        return new SiteVerificationPolicy(properties(require), environment);
    }

    private static BrandImportProperties properties(Boolean require) {
        return new BrandImportProperties(null, Duration.ofSeconds(2), 50, 100, Duration.ofMinutes(10), false,
            Duration.ofDays(1), true, List.of(), Duration.ZERO, require);
    }
}
