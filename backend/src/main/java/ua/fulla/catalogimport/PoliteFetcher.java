package ua.fulla.catalogimport;

import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import java.util.Set;

/**
 * The only way the importer touches the network (ADR-0014). One instance per source and run:
 * one request at a time, at least {@code delay} between requests, honest User-Agent, robots.txt
 * respected, {@code https} and the source host only (also after redirects, max 3), body size
 * caps, a hard cap on requests, and a stop on 403/429/bot challenge. No retries.
 */
class PoliteFetcher {

    static final String USER_AGENT = "FULLA-demo-importer/0.1";
    static final String AGENT_TOKEN = "FULLA-demo-importer";
    static final Duration TIMEOUT = Duration.ofSeconds(15);
    static final long ROBOTS_MAX_BYTES = 512 * 1024;
    private static final int MAX_REDIRECTS = 3;
    private static final Set<Integer> REDIRECTS = Set.of(301, 302, 303, 307, 308);

    /** Reads the body of a successful response; the stream is closed by the fetcher. */
    @FunctionalInterface
    interface BodyReader<T> {
        T read(InputStream body) throws IOException;
    }

    private final HttpClient client;
    private final String host;
    private final URI baseUrl;
    private final Duration delay;
    private final int maxRequests;
    private RobotsRules robots;
    private int requests;
    private long lastRequestNanos;

    PoliteFetcher(HttpClient client, URI baseUrl, Duration delay, int maxRequests) {
        this.client = client;
        this.baseUrl = baseUrl;
        this.host = baseUrl.getHost().toLowerCase(Locale.ROOT);
        this.delay = delay;
        this.maxRequests = maxRequests;
    }

    /**
     * First request of every run. 404 → everything allowed; any other non-2xx, a timeout or a
     * network error → {@link SourceStoppedException} (the source is skipped this run).
     */
    void loadRobots() {
        try {
            String text = get(baseUrl.resolve("/robots.txt"), ROBOTS_MAX_BYTES, false,
                body -> new String(body.readAllBytes(), StandardCharsets.UTF_8));
            robots = text == null ? RobotsRules.allowAll() : RobotsRules.parse(text, AGENT_TOKEN);
        } catch (IOException e) {
            throw new SourceStoppedException("robots.txt can't be read: " + e.getMessage(), e);
        }
    }

    boolean hasRequestBudget() {
        return requests < maxRequests;
    }

    int requestsMade() {
        return requests;
    }

    /** UTF-8 text of the page, or null when robots.txt disallows it or it is gone (404/410). */
    String getText(String url, long maxBytes) throws IOException {
        return getStream(url, maxBytes, body -> new String(body.readAllBytes(), StandardCharsets.UTF_8));
    }

    /** Like {@link #getText}, but streams the body (the reader may stop early, e.g. after 50 items). */
    <T> T getStream(String url, long maxBytes, BodyReader<T> reader) throws IOException {
        if (robots == null) {
            throw new IllegalStateException("loadRobots() first");
        }
        URI uri = checkedUri(url);
        if (!robots.isAllowed(pathAndQuery(uri))) {
            return null; // skipped, never retried another way
        }
        return get(uri, maxBytes, true, reader);
    }

    private <T> T get(URI start, long maxBytes, boolean checkRobots, BodyReader<T> reader) throws IOException {
        URI uri = start;
        for (int hop = 0; ; hop++) {
            HttpResponse<InputStream> response = send(uri);
            int status = response.statusCode();
            if (response.headers().firstValue("cf-mitigated").isPresent()) {
                close(response);
                throw new SourceStoppedException("Bot challenge on " + uri);
            }
            if (status == 403 || status == 429) {
                close(response);
                throw new SourceStoppedException("HTTP " + status + " on " + uri);
            }
            if (REDIRECTS.contains(status)) {
                close(response);
                if (hop >= MAX_REDIRECTS) {
                    throw new IOException("Too many redirects from " + start);
                }
                String location = response.headers().firstValue("location")
                    .orElseThrow(() -> new IOException("Redirect without Location from " + response.uri()));
                uri = checkedUri(response.uri().resolve(location).toString());
                if (checkRobots && !robots.isAllowed(pathAndQuery(uri))) {
                    return null;
                }
                continue;
            }
            if (status == 404 || status == 410) {
                close(response);
                return null;
            }
            if (status < 200 || status > 299) {
                close(response);
                throw new IOException("HTTP " + status + " on " + uri);
            }
            try (InputStream body = new CappedInputStream(response.body(), maxBytes)) {
                return reader.read(body);
            }
        }
    }

    private HttpResponse<InputStream> send(URI uri) throws IOException {
        if (requests >= maxRequests) {
            throw new IOException("Request cap of " + maxRequests + " reached");
        }
        waitForTurn();
        requests++;
        HttpRequest request = HttpRequest.newBuilder(uri)
            .timeout(TIMEOUT)
            .header("User-Agent", USER_AGENT)
            .GET()
            .build();
        try {
            return client.send(request, HttpResponse.BodyHandlers.ofInputStream());
        } catch (HttpTimeoutException e) {
            throw new IOException("Timeout on " + uri, e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Interrupted", e);
        } finally {
            lastRequestNanos = System.nanoTime();
        }
    }

    private void waitForTurn() throws IOException {
        if (lastRequestNanos == 0) {
            return;
        }
        long waitNanos = delay.toNanos() - (System.nanoTime() - lastRequestNanos);
        if (waitNanos > 0) {
            try {
                Thread.sleep(Duration.ofNanos(waitNanos));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IOException("Interrupted", e);
            }
        }
    }

    /** SSRF guard: only {@code https} and exactly the source host. */
    private URI checkedUri(String url) throws IOException {
        URI uri = ImportText.parse(url);
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null
                || !uri.getHost().toLowerCase(Locale.ROOT).equals(host)) {
            throw new IOException("Not an https URL of " + host + ": " + url);
        }
        return uri;
    }

    private static String pathAndQuery(URI uri) {
        String path = uri.getRawPath() == null || uri.getRawPath().isEmpty() ? "/" : uri.getRawPath();
        return uri.getRawQuery() == null ? path : path + "?" + uri.getRawQuery();
    }

    private static void close(HttpResponse<InputStream> response) {
        try {
            response.body().close();
        } catch (IOException ignored) {
            // nothing to do: the response is discarded anyway
        }
    }

    /** Fails the read once more than {@code max} bytes arrive. */
    private static final class CappedInputStream extends FilterInputStream {
        private final long max;
        private long count;

        CappedInputStream(InputStream in, long max) {
            super(in);
            this.max = max;
        }

        @Override
        public int read() throws IOException {
            int b = super.read();
            if (b >= 0) {
                count(1);
            }
            return b;
        }

        @Override
        public int read(byte[] buffer, int offset, int length) throws IOException {
            int n = super.read(buffer, offset, length);
            if (n > 0) {
                count(n);
            }
            return n;
        }

        private void count(int n) throws IOException {
            count += n;
            if (count > max) {
                throw new IOException("Response larger than " + max + " bytes");
            }
        }
    }
}
