package ua.fulla.catalogimport;

import java.net.URI;
import java.net.http.HttpClient;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * The network part of the demo import: only with profile {@code dev} AND
 * {@code fulla.import.enabled=true} (ADR-0014). Tests, {@code ops} and {@code prod} never get
 * these beans. Scheduling is enabled here and nowhere else.
 */
@Configuration
@Profile("dev")
@ConditionalOnProperty(name = "fulla.import.enabled", havingValue = "true")
@EnableScheduling
@EnableConfigurationProperties(ImportProperties.class)
class CatalogImportConfig {

    @Bean
    CatalogImportJob catalogImportJob(ImportProperties properties, CatalogSyncService sync) {
        ImportProperties.Sources sources = properties.sources();
        List<CatalogImporter> importers = List.of(
            new VsiSvoiFeedImporter(URI.create(sources.vsisvoi())),
            new JsonLdSitemapImporter("onebyone", URI.create(sources.onebyone()), "One By One",
                JsonLdSitemapImporter.Site.ONE_BY_ONE),
            new JsonLdSitemapImporter("cher17", URI.create(sources.cher17()), "CHER'17",
                JsonLdSitemapImporter.Site.CHER17));
        HttpClient client = HttpClient.newBuilder()
            .connectTimeout(PoliteFetcher.TIMEOUT)
            .followRedirects(HttpClient.Redirect.NEVER) // redirects are checked by PoliteFetcher
            .build();
        return new CatalogImportJob(importers, sync, properties, client);
    }
}
