package ua.fulla.catalogimport;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.net.Authenticator;
import java.net.CookieHandler;
import java.net.InetAddress;
import java.net.ProxySelector;
import java.net.URI;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLParameters;
import javax.net.ssl.SSLSession;

/**
 * A fake internet for the import tests: an {@link HttpClient} that answers from a map of URLs
 * (unknown URL → 404) and a DNS {@link PoliteFetcher.Resolver} (unknown host → a public
 * address). Every request that reaches the "network" is recorded. Nothing real is contacted.
 */
final class FakeWeb {

    record Answer(int status, Map<String, List<String>> headers, byte[] body) {}

    private static final String PUBLIC_IP = "93.184.216.34";

    private final Map<String, Answer> answers = new ConcurrentHashMap<>();
    private final Map<String, String> dns = new ConcurrentHashMap<>();
    private final List<HttpRequest> requests = Collections.synchronizedList(new ArrayList<>());

    FakeWeb page(String url, String contentType, String body) {
        answers.put(url, new Answer(200, Map.of("content-type", List.of(contentType)),
            body.getBytes(StandardCharsets.UTF_8)));
        return this;
    }

    FakeWeb html(String url, String body) {
        return page(url, "text/html; charset=utf-8", body);
    }

    FakeWeb fixture(String url, String contentType, String name) {
        return page(url, contentType, fixtureText(name));
    }

    FakeWeb redirect(String url, String location) {
        answers.put(url, new Answer(302, Map.of("location", List.of(location)), new byte[0]));
        return this;
    }

    FakeWeb status(String url, int status) {
        answers.put(url, new Answer(status, Map.of("content-type", List.of("text/html")), new byte[0]));
        return this;
    }

    /** {@code host} resolves to these addresses (literal IPs). */
    FakeWeb dns(String host, String... ips) {
        dns.put(host, String.join(",", ips));
        return this;
    }

    List<String> requestedUrls() {
        synchronized (requests) {
            return requests.stream().map(r -> r.uri().toString()).toList();
        }
    }

    List<HttpRequest> requests() {
        synchronized (requests) {
            return List.copyOf(requests);
        }
    }

    PoliteFetcher.Resolver resolver() {
        return host -> {
            String ips = dns.getOrDefault(host, PUBLIC_IP);
            String[] parts = ips.split(",");
            InetAddress[] result = new InetAddress[parts.length];
            for (int i = 0; i < parts.length; i++) {
                try {
                    result[i] = InetAddress.getByName(parts[i]); // literal IPs only: no lookup
                } catch (UnknownHostException e) {
                    throw new IllegalArgumentException(e);
                }
            }
            return result;
        };
    }

    /** A fetcher for a brand site (ADR-0017 policy), no pause between requests. */
    PoliteFetcher fetcher(String domain, int maxRequests) {
        return new SiteFetcherFactory(client(), resolver(), Duration.ZERO, "FULLA-bot/1.0 (+https://fulla.example/bot)")
            .forSite(domain, domain, maxRequests);
    }

    static String fixtureText(String name) {
        try (InputStream in = FakeWeb.class.getResourceAsStream("/brandimport/" + name)) {
            if (in == null) {
                throw new IllegalArgumentException("No fixture " + name);
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    HttpClient client() {
        return new HttpClient() {
            @Override
            public Optional<CookieHandler> cookieHandler() {
                return Optional.empty();
            }

            @Override
            public Optional<Duration> connectTimeout() {
                return Optional.empty();
            }

            @Override
            public Redirect followRedirects() {
                return Redirect.NEVER;
            }

            @Override
            public Optional<ProxySelector> proxy() {
                return Optional.empty();
            }

            @Override
            public SSLContext sslContext() {
                return null;
            }

            @Override
            public SSLParameters sslParameters() {
                return null;
            }

            @Override
            public Optional<Authenticator> authenticator() {
                return Optional.empty();
            }

            @Override
            public Version version() {
                return Version.HTTP_1_1;
            }

            @Override
            public Optional<Executor> executor() {
                return Optional.empty();
            }

            @Override
            @SuppressWarnings("unchecked")
            public <T> HttpResponse<T> send(HttpRequest request, HttpResponse.BodyHandler<T> handler) {
                requests.add(request);
                Answer answer = answers.getOrDefault(request.uri().toString(),
                    new Answer(404, Map.of("content-type", List.of("text/html")), new byte[0]));
                return (HttpResponse<T>) new Response(request, answer);
            }

            @Override
            public <T> CompletableFuture<HttpResponse<T>> sendAsync(HttpRequest request,
                    HttpResponse.BodyHandler<T> handler) {
                return CompletableFuture.completedFuture(send(request, handler));
            }

            @Override
            public <T> CompletableFuture<HttpResponse<T>> sendAsync(HttpRequest request,
                    HttpResponse.BodyHandler<T> handler, HttpResponse.PushPromiseHandler<T> pushPromiseHandler) {
                return sendAsync(request, handler);
            }
        };
    }

    private record Response(HttpRequest request, Answer answer) implements HttpResponse<InputStream> {
        @Override
        public int statusCode() {
            return answer.status();
        }

        @Override
        public Optional<HttpResponse<InputStream>> previousResponse() {
            return Optional.empty();
        }

        @Override
        public HttpHeaders headers() {
            return HttpHeaders.of(answer.headers(), (name, value) -> true);
        }

        @Override
        public InputStream body() {
            return new ByteArrayInputStream(answer.body());
        }

        @Override
        public Optional<SSLSession> sslSession() {
            return Optional.empty();
        }

        @Override
        public URI uri() {
            return request.uri();
        }

        @Override
        public HttpClient.Version version() {
            return HttpClient.Version.HTTP_1_1;
        }
    }
}
