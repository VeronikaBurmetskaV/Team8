package ua.fulla.catalogimport;

import java.time.Instant;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ua.fulla.common.SessionAccount;

/** Brand site verification and import (ADR-0017, api.md §2.1); ROLE_BRAND is required by SecurityConfig. */
@RestController
class BrandSiteController {

    record VerifyResponse(String siteDomain, Instant siteVerifiedAt, SiteVerifier.Method method) {}

    /** {@code status}: IDLE | RUNNING | DONE | FAILED; {@code method}: FEED | SHOPIFY | SITEMAP | null. */
    record ImportStatusResponse(
            String status,
            String method,
            Instant startedAt,
            Instant finishedAt,
            Instant lastSuccessAt,
            Instant nextAllowedAt,
            int found,
            int created,
            int updated,
            int skipped,
            int hidden,
            String errorCode,
            /** False only in demo mode (profile dev): the client then shows no verification step. */
            boolean verificationRequired,
            /** {@code !verificationRequired}. */
            boolean demoMode) {}

    private final BrandSiteService sites;
    private final BrandImportService imports;
    private final BrandImportProperties properties;

    BrandSiteController(BrandSiteService sites, BrandImportService imports, BrandImportProperties properties) {
        this.sites = sites;
        this.imports = imports;
        this.properties = properties;
    }

    @PostMapping("/api/brand/site/verify")
    VerifyResponse verify(@AuthenticationPrincipal SessionAccount brand) {
        var verified = sites.verify(brand.accountId(), brand.email());
        return new VerifyResponse(verified.siteDomain(), verified.siteVerifiedAt(), verified.method());
    }

    /** Starts the import in the background: 202 with the state, now RUNNING. */
    @PostMapping("/api/brand/import")
    @ResponseStatus(HttpStatus.ACCEPTED)
    ImportStatusResponse startImport(@AuthenticationPrincipal SessionAccount brand) {
        return response(imports.requestImport(brand.accountId()));
    }

    @GetMapping("/api/brand/import/status")
    ImportStatusResponse status(@AuthenticationPrincipal SessionAccount brand) {
        return response(imports.status(brand.accountId()));
    }

    private ImportStatusResponse response(BrandImportState state) {
        Instant next = state.startedAt() == null ? null : state.startedAt().plus(properties.importInterval());
        return new ImportStatusResponse(
            state.status().toUpperCase(Locale.ROOT),
            state.method() == null ? null : state.method().toUpperCase(Locale.ROOT),
            state.startedAt(),
            state.finishedAt(),
            state.lastSuccessAt(),
            next,
            state.found(),
            state.created(),
            state.updated(),
            state.skipped(),
            state.hidden(),
            state.errorCode(),
            imports.verificationRequired(),
            !imports.verificationRequired());
    }
}
