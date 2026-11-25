-- Brand site import (ADR-0017): site ownership on brand_profiles, the import state per brand,
-- and the columns of cards a brand imports from its own site.

-- 1. Site ownership. The token is random per profile (also for existing rows: a volatile
--    default is evaluated per row). site_verified_at and site_domain are set together by
--    POST /api/brand/site/verify and cleared together when websiteUrl moves to another domain.
ALTER TABLE brand_profiles
    ADD COLUMN verification_token varchar(64) NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
    ADD COLUMN site_verified_at   timestamptz,
    ADD COLUMN site_domain        varchar(253),
    ADD COLUMN feed_url           varchar(2048);

ALTER TABLE brand_profiles
    ADD CONSTRAINT brand_profiles_verification_token_format CHECK (verification_token ~ '^[a-z0-9]{32,64}$'),
    ADD CONSTRAINT brand_profiles_site_verified_pair CHECK ((site_verified_at IS NULL) = (site_domain IS NULL)),
    ADD CONSTRAINT brand_profiles_site_domain_lower CHECK (site_domain IS NULL OR site_domain = lower(site_domain)),
    ADD CONSTRAINT brand_profiles_feed_url_https CHECK (feed_url IS NULL OR feed_url LIKE 'https://%');

-- 2. The import state of a brand: one row, created on the first import request.
CREATE TABLE brand_imports (
    brand_id        uuid        NOT NULL,
    status          varchar(10) NOT NULL DEFAULT 'idle',
    method          varchar(10),
    started_at      timestamptz,
    finished_at     timestamptz,
    last_success_at timestamptz,
    found_count     integer     NOT NULL DEFAULT 0,
    created_count   integer     NOT NULL DEFAULT 0,
    updated_count   integer     NOT NULL DEFAULT 0,
    skipped_count   integer     NOT NULL DEFAULT 0,
    hidden_count    integer     NOT NULL DEFAULT 0,
    error_code      varchar(40),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT brand_imports_pk PRIMARY KEY (brand_id),
    CONSTRAINT brand_imports_brand_fk FOREIGN KEY (brand_id) REFERENCES brand_accounts (id),
    CONSTRAINT brand_imports_status CHECK (status IN ('idle', 'running', 'done', 'failed')),
    CONSTRAINT brand_imports_method CHECK (method IS NULL OR method IN ('feed', 'shopify', 'sitemap')),
    CONSTRAINT brand_imports_running_started CHECK (status <> 'running' OR started_at IS NOT NULL),
    CONSTRAINT brand_imports_counts CHECK (found_count >= 0 AND created_count >= 0 AND updated_count >= 0
                                           AND skipped_count >= 0 AND hidden_count >= 0)
);

-- 3. products: a brand's card imported from its own site has external_id (the product URL
--    path), source_url (where it was read) and last_synced_at; edited_fields lists the fields
--    the brand changed by hand, which a re-import never overwrites.
ALTER TABLE products
    ADD COLUMN source_url    varchar(2048),
    ADD COLUMN edited_fields text[] NOT NULL DEFAULT '{}';

-- The demo-import rule (all import columns set or all empty) now has a second shape.
ALTER TABLE products DROP CONSTRAINT products_import_columns;

ALTER TABLE products
    ADD CONSTRAINT products_import_columns CHECK (
        CASE WHEN source_id IS NOT NULL
             -- demo import (ADR-0014): source brand, external ID and sync time; no source_url
             THEN source_brand_id IS NOT NULL AND external_id IS NOT NULL AND last_synced_at IS NOT NULL
                  AND source_url IS NULL
             -- a brand's card: either all three brand-import columns or none
             ELSE source_brand_id IS NULL
                  AND (external_id IS NULL) = (source_url IS NULL)
                  AND (external_id IS NULL) = (last_synced_at IS NULL)
        END),
    ADD CONSTRAINT products_source_url_https CHECK (source_url IS NULL OR source_url LIKE 'https://%'),
    -- A re-import updates the brand's card of the same product instead of adding another one.
    ADD CONSTRAINT products_brand_external_uk UNIQUE (brand_id, external_id),
    ADD CONSTRAINT products_edited_fields_known
        CHECK (edited_fields <@ ARRAY['name', 'price_uah', 'photo', 'product_url']::text[]),
    ADD CONSTRAINT products_edited_fields_imported
        CHECK (edited_fields = '{}' OR (brand_id IS NOT NULL AND external_id IS NOT NULL));
