package ua.fulla.catalogimport;

import java.io.IOException;

/**
 * {@link PoliteFetcher} refused a URL before sending anything (ADR-0017): not {@code https},
 * not port 443, another domain, user info in the URL, or a host that resolves to a non-public
 * address. Also thrown for a redirect to such a URL.
 */
class UnsafeUrlException extends IOException {

    UnsafeUrlException(String message) {
        super(message);
    }
}
