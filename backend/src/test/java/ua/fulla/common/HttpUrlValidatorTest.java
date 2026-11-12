package ua.fulla.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * The @HttpUrl rule (US-26 CL, T-12). The frontend zod schema in shared/validation.ts should
 * be tested with the same examples (R-T17).
 */
class HttpUrlValidatorTest {

    static final List<String> VALID = List.of(
        "https://brand-site.ua/linen-dress",
        "http://brand.ua/x",
        "https://brand.ua",
        "HTTPS://Brand.ua/Dress",
        "https://brand-site.ua/product?id=42",
        "https://brand-site.ua/product?id=42#reviews",
        "https://brand.ua/сукня?колір=зелений",
        "https://shop.brand.ua:8443/p/1");

    static final List<String> INVALID = List.of(
        "",
        "сукня",
        "brand.ua/x",
        "www.brand.ua/x",
        "javascript:alert(1)",
        "data:text/html,<b>x</b>",
        "ftp://brand.ua/x",
        "mailto:shop@brand.ua",
        "http://",
        "https:///dress",
        "http:brand.ua",
        "http:/brand.ua",
        " https://brand.ua/x",
        "https://brand.ua/linen dress",
        "https://brand.ua/\u0000");

    final HttpUrlValidator validator = new HttpUrlValidator();

    @Test
    void absoluteHttpAndHttpsUrlsWithAHostAreValid() {
        for (String url : VALID) {
            assertThat(validator.isValid(url, null)).as(url).isTrue();
        }
    }

    @Test
    void everythingElseIsInvalid() {
        for (String url : INVALID) {
            assertThat(validator.isValid(url, null)).as(url).isFalse();
        }
    }

    @Test
    void nullIsLeftToNotNull() {
        assertThat(validator.isValid(null, null)).isTrue();
    }
}
