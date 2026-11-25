package ua.fulla.catalogimport;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

/**
 * Whether a brand must verify its site before an import (ADR-0017, demo mode). Verification is
 * required unless {@code fulla.brand-import.require-site-verification=false}, which only
 * {@code application-dev.yml} sets. With profile {@code prod} or {@code ops} active it is always
 * required, whatever the setting says: a wrong config can't open the import there.
 */
@Component
class SiteVerificationPolicy {

    private static final Logger log = LoggerFactory.getLogger(SiteVerificationPolicy.class);

    private final boolean required;

    SiteVerificationPolicy(BrandImportProperties properties, Environment environment) {
        boolean configured = properties.siteVerificationRequired();
        boolean publicProfile = environment.acceptsProfiles(Profiles.of("prod | ops"));
        if (!configured && publicProfile) {
            log.warn("fulla.brand-import.require-site-verification=false is ignored with profile prod/ops");
        }
        this.required = configured || publicProfile;
        if (!this.required) {
            log.info("Brand site import in demo mode: site ownership is not checked (local development only)");
        }
    }

    /** True = the brand must verify its site; false = demo mode (local dev). */
    boolean required() {
        return required;
    }
}
