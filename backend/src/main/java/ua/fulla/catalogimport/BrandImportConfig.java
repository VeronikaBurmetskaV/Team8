package ua.fulla.catalogimport;

import java.net.InetAddress;
import java.net.http.HttpClient;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Brand site import (ADR-0017), every profile: the fetcher factory, the thread that runs imports
 * after {@code POST /api/brand/import}, and scheduling for the daily refresh.
 */
@Configuration
@EnableScheduling
@EnableConfigurationProperties(BrandImportProperties.class)
class BrandImportConfig {

    @Bean
    SiteFetcherFactory siteFetcherFactory(BrandImportProperties properties) {
        HttpClient client = HttpClient.newBuilder()
            .connectTimeout(PoliteFetcher.TIMEOUT)
            .followRedirects(HttpClient.Redirect.NEVER) // every hop is checked by PoliteFetcher
            .build();
        return new SiteFetcherFactory(client, InetAddress::getAllByName, properties.delay(), properties.userAgent());
    }

    /** Two imports at a time at most; the rest wait in the queue. */
    @Bean(destroyMethod = "shutdownNow")
    ExecutorService brandImportExecutor() {
        AtomicInteger number = new AtomicInteger();
        return Executors.newFixedThreadPool(2, runnable -> {
            Thread thread = new Thread(runnable, "brand-import-" + number.incrementAndGet());
            thread.setDaemon(true);
            return thread;
        });
    }
}
