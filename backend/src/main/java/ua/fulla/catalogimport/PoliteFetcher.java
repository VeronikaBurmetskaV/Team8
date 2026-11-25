package ua.fulla.catalogimport;

import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import java.util.Set;

/**
 * The only way the server touches a brand's or a source's site (ADR-0014, ADR-0017). One
 * instance per source/brand and run: one request at a time, at least {@code delay} between
 * requests, honest User-Agent, robots.txt respected, a hard cap on requests, body size caps, and
 * a stop on 403/429/bot challenge. No retries.
 *
 * <p>SSRF guards, checked for the first URL <b>and again for every redirect</b> (max 3), before
 * anything is sent: {@code https} only, port 443, no user info, the host must be the allowed
 * domain (or a subdomain, when the {@link Policy} allows it), and every address the host
 * resolves to must be public ({@link AddressGuard}). The JDK caches a positive DNS answer for
 * 30 s, so the {@code HttpClient}'s own lookup right after ours gets the same addresses.
 * Optionally only listed {@code Content-Type}s are read.
 */
class PoliteFetcher {

    static final String USER_AGENT = "FULLA-demo-importer/0.1";
    static final String AGENT_TOKEN = "FULLA-demo-importer";

    /** Resolves a host name; {@code InetAddress::getAllByName} outside tests. */
    @FunctionalInterface
    interface Resolver {
        InetAddress[] resolve(String host) throws UnknownHostException;
    }

    /**
     * Who we say we are and where we may go.
     *
     * @param domain       the allowed host (e.g. {@code brand.ua})
     * @param subdomains   also allow {@code www.brand.ua}, {@code shop.brand.ua}, …
     * @param contentTypes allowed media types of a 2xx body (lower case, no parameters); null = any
     */
    record Policy(String userAgent, String agentToken, String domain, boolean subdomains, Set<String> contentTypes,
            Resolver resolver) {

        /** ADR-0014 demo sources: exactly the source host, any content type. */
        static Policy demo(URI baseUrl) {
            return new Policy(USER_AGENT, AGENT_TOKEN, baseUrl.getHost(), false, null, InetAddress::getAllByName);
        }

        boolean allowsHost(String host) {
            String h = host.toLowerCase(Locale.ROOT);
            String d = domain.toLowerCase(Locale.ROOT);
            return h.equals(d) || (subdomains && h.endsWith("." + d));
        }
    }
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
    private final URI baseUrl;
    private final Duration delay;
    private final int maxRequests;
    private final Policy policy;
    private RobotsRules robots;
    private int requests;
    private int robotsBlocked;
    private long lastRequestNanos;

    /** A demo source of ADR-0014. */
    PoliteFetcher(HttpClient client, URI baseUrl, Duration delay, int maxRequests) {
        this(client, baseUrl, delay, maxRequests, Policy.demo(baseUrl));
    }

    PoliteFetcher(HttpClient client, URI baseUrl, Duration delay, int maxRequests, Policy policy) {
        this.client = client;
        this.baseUrl = baseUrl;
        this.delay = delay;
        this.maxRequests = maxRequests;
        this.policy = policy;
    }

    /**
     * First request of every run. 404 → everything allowed; any other non-2xx, a timeout or a
     * network error → {@link SourceStoppedException} (the source is skipped this run).
     */
    void loadRobots() {
        try {
            String text = get(baseUrl.resolve("/robots.txt"), ROBOTS_MAX_BYTES, false,
                body -> new String(body.readAllBytes(), StandardCharsets.UTF_8));
            robots = text == null ? RobotsRules.allowAll() : RobotsRules.parse(text, policy.agentToken());
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

    /** How many URLs robots.txt did not let us read in this run. */
    int robotsBlocked() {
        return robotsBlocked;
    }

    URI baseUrl() {
        return baseUrl;
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
            robotsBlocked++;
            return null; // skipped, never retried another way
        }
        return get(uri, maxBytes, true, reader);
    }

    private <T> T get(URI start, long maxBytes, boolean checkRobots, BodyReader<T> reader) throws IOException {
        URI uri = checkedUri(start.toString());
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
                // The same SSRF checks (scheme, port, domain, public address) for every hop.
                uri = checkedUri(response.uri().resolve(location).toString());
                if (checkRobots && !robots.isAllowed(pathAndQuery(uri))) {
                    robotsBlocked++;
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
            if (policy.contentTypes() != null) {
                String type = mediaType(response.headers().firstValue("content-type").orElse(""));
                if (!policy.contentTypes().contains(type)) {
                    close(response);
                    throw new IOException("Content-Type '" + type + "' is not allowed on " + uri);
                }
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
            .header("User-Agent", policy.userAgent())
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

    /**
     * SSRF guard: {@code https}, port 443 (or none), no user info, an allowed host, and only
     * public addresses behind it. Nothing is sent for a refused URL.
     */
    private URI checkedUri(String url) throws IOException {
        URI uri = ImportText.parse(url);
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null
                || !policy.allowsHost(uri.getHost())) {
            throw new UnsafeUrlException("Not an https URL of " + policy.domain() + ": " + url);
        }
        if (uri.getPort() != -1 && uri.getPort() != 443) {
            throw new UnsafeUrlException("Only port 443 is allowed: " + url);
        }
        if (uri.getRawUserInfo() != null) {
            throw new UnsafeUrlException("User info is not allowed in " + url);
        }
        InetAddress[] addresses;
        try {
            addresses = policy.resolver().resolve(uri.getHost());
        } catch (UnknownHostException e) {
            throw new IOException("Unknown host " + uri.getHost(), e);
        }
        if (addresses == null || addresses.length == 0) {
            throw new IOException("Unknown host " + uri.getHost());
        }
        for (InetAddress address : addresses) {
            if (!AddressGuard.isPublic(address)) {
                throw new UnsafeUrlException(uri.getHost() + " resolves to a non-public address");
            }
        }
        return uri;
    }

    /** {@code "text/html; charset=utf-8"} → {@code text/html}. */
    private static String mediaType(String contentType) {
        int semicolon = contentType.indexOf(';');
        String type = semicolon < 0 ? contentType : contentType.substring(0, semicolon);
        return type.strip().toLowerCase(Locale.ROOT);
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
