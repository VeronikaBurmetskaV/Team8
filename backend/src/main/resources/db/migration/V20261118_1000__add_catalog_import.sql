-- Demo catalogue import (ADR-0014, profile dev only): data-model.md §5.
-- Source rows are inserted by the importer (INSERT … ON CONFLICT (code) DO NOTHING), so this
-- file contains no site URLs.

CREATE TABLE catalog_sources (
    id              uuid          NOT NULL DEFAULT gen_random_uuid(),
    code            varchar(30)   NOT NULL,
    base_url        varchar(2048) NOT NULL,
    last_run_at     timestamptz,
    last_run_status varchar(10),
    created_at      timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT catalog_sources_pk PRIMARY KEY (id),
    CONSTRAINT catalog_sources_code_uk UNIQUE (code),
    CONSTRAINT catalog_sources_code_format CHECK (code ~ '^[a-z0-9-]+$'),
    CONSTRAINT catalog_sources_base_url_https CHECK (base_url LIKE 'https://%'),
    CONSTRAINT catalog_sources_last_run_status
        CHECK (last_run_status IS NULL OR last_run_status IN ('ok', 'partial', 'skipped', 'failed'))
);

-- Brands without accounts: no email, password, profile, logo or consent; they can't log in.
CREATE TABLE source_brands (
    id         uuid        NOT NULL DEFAULT gen_random_uuid(),
    source_id  uuid        NOT NULL,
    name       varchar(50) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT source_brands_pk PRIMARY KEY (id),
    CONSTRAINT source_brands_source_fk FOREIGN KEY (source_id) REFERENCES catalog_sources (id),
    CONSTRAINT source_brands_name_length CHECK (char_length(btrim(name)) BETWEEN 2 AND 50),
    CONSTRAINT source_brands_source_name_uk UNIQUE (source_id, name),
    -- Target of the composite FK on products: the card's brand must belong to the card's source.
    CONSTRAINT source_brands_id_source_uk UNIQUE (id, source_id)
);

ALTER TABLE products ALTER COLUMN brand_id DROP NOT NULL;

ALTER TABLE products
    ADD COLUMN source_id       uuid,
    ADD COLUMN source_brand_id uuid,
    ADD COLUMN external_id     varchar(100),
    ADD COLUMN last_synced_at  timestamptz,
    ADD COLUMN sizes           jsonb,
    ADD COLUMN colors          jsonb,
    ADD COLUMN material        varchar(500),
    ADD COLUMN description     text;

ALTER TABLE products
    ADD CONSTRAINT products_source_fk FOREIGN KEY (source_id) REFERENCES catalog_sources (id),
    ADD CONSTRAINT products_source_brand_fk FOREIGN KEY (source_brand_id, source_id)
        REFERENCES source_brands (id, source_id),
    ADD CONSTRAINT products_source_external_uk UNIQUE (source_id, external_id),
    ADD CONSTRAINT products_sizes_array CHECK (sizes IS NULL OR jsonb_typeof(sizes) = 'array'),
    ADD CONSTRAINT products_colors_array CHECK (colors IS NULL OR jsonb_typeof(colors) = 'array'),
    ADD CONSTRAINT products_description_length
        CHECK (description IS NULL OR char_length(description) <= 5000),
    -- Exactly one owner: an account brand or a source brand.
    ADD CONSTRAINT products_one_owner CHECK ((brand_id IS NULL) <> (source_brand_id IS NULL)),
    -- Import columns are all set or all empty.
    ADD CONSTRAINT products_import_columns CHECK (
        (source_id IS NULL) = (source_brand_id IS NULL)
        AND (source_id IS NULL) = (external_id IS NULL)
        AND (source_id IS NULL) = (last_synced_at IS NULL)),
    -- Imported cards never use the images table (no copies, ADR-0007).
    ADD CONSTRAINT products_import_photo_url CHECK (source_id IS NULL OR photo_url IS NOT NULL);
