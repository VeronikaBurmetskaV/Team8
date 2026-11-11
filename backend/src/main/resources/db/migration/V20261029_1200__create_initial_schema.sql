-- Initial schema: docs/architecture/data-model.md §2 (tables) and §3 (indexes).
-- Invariants the schema cannot express (T-1…T-14) live in service/repository SQL.

CREATE TABLE brand_accounts (
    id            uuid         NOT NULL DEFAULT gen_random_uuid(),
    email         varchar(254) NOT NULL,
    password_hash varchar(72)  NOT NULL,
    created_at    timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT brand_accounts_pk PRIMARY KEY (id),
    CONSTRAINT brand_accounts_email_uk UNIQUE (email),
    CONSTRAINT brand_accounts_email_normalized CHECK (email = lower(btrim(email))),
    CONSTRAINT brand_accounts_email_format CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

CREATE TABLE images (
    id           uuid        NOT NULL DEFAULT gen_random_uuid(),
    uploaded_by  uuid        NOT NULL,
    content_type varchar(20) NOT NULL,
    size_bytes   integer     NOT NULL,
    bytes        bytea       NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT images_pk PRIMARY KEY (id),
    CONSTRAINT images_uploaded_by_fk FOREIGN KEY (uploaded_by) REFERENCES brand_accounts (id),
    CONSTRAINT images_content_type CHECK (content_type IN ('image/png', 'image/jpeg', 'image/webp')),
    CONSTRAINT images_size_bytes CHECK (size_bytes BETWEEN 1 AND 5242880)
);

CREATE INDEX images_uploaded_by_idx ON images (uploaded_by);

CREATE TABLE brand_profiles (
    brand_id         uuid          NOT NULL,
    name             varchar(50),
    logo_image_id    uuid,
    logo_url         varchar(2048),
    consent_given_at timestamptz,
    consent_text     text,
    created_at       timestamptz   NOT NULL DEFAULT now(),
    updated_at       timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT brand_profiles_pk PRIMARY KEY (brand_id),
    CONSTRAINT brand_profiles_brand_fk FOREIGN KEY (brand_id) REFERENCES brand_accounts (id),
    CONSTRAINT brand_profiles_logo_image_fk FOREIGN KEY (logo_image_id) REFERENCES images (id),
    CONSTRAINT brand_profiles_name_length CHECK (name IS NULL OR char_length(btrim(name)) BETWEEN 2 AND 50),
    CONSTRAINT brand_profiles_logo_url_https CHECK (logo_url IS NULL OR logo_url LIKE 'https://%'),
    CONSTRAINT brand_profiles_one_logo_source CHECK (logo_image_id IS NULL OR logo_url IS NULL),
    CONSTRAINT brand_profiles_consent_pair CHECK ((consent_given_at IS NULL) = (consent_text IS NULL)),
    CONSTRAINT brand_profiles_consent_needs_name CHECK (consent_given_at IS NULL OR name IS NOT NULL)
);

CREATE TABLE products (
    id             uuid          NOT NULL DEFAULT gen_random_uuid(),
    brand_id       uuid          NOT NULL,
    name           varchar(100)  NOT NULL,
    price_uah      integer       NOT NULL,
    photo_image_id uuid,
    photo_url      varchar(2048),
    product_url    varchar(2048) NOT NULL,
    status         varchar(10)   NOT NULL DEFAULT 'draft',
    published_at   timestamptz,
    created_at     timestamptz   NOT NULL DEFAULT now(),
    updated_at     timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT products_pk PRIMARY KEY (id),
    CONSTRAINT products_brand_fk FOREIGN KEY (brand_id) REFERENCES brand_accounts (id),
    CONSTRAINT products_photo_image_fk FOREIGN KEY (photo_image_id) REFERENCES images (id),
    CONSTRAINT products_name_length CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
    CONSTRAINT products_price_range CHECK (price_uah > 0 AND price_uah <= 1000000),
    CONSTRAINT products_photo_url_https CHECK (photo_url IS NULL OR photo_url LIKE 'https://%'),
    CONSTRAINT products_one_photo_source CHECK ((photo_image_id IS NULL) <> (photo_url IS NULL)),
    CONSTRAINT products_product_url_http CHECK (product_url ~* '^https?://[^/\s]+'),
    CONSTRAINT products_status CHECK (status IN ('draft', 'published')),
    CONSTRAINT products_published_at CHECK ((status = 'published') = (published_at IS NOT NULL))
);

CREATE INDEX products_feed_idx ON products (published_at, id) WHERE status = 'published';
CREATE INDEX products_brand_created_idx ON products (brand_id, created_at DESC);

CREATE TABLE buyer_accounts (
    id            uuid         NOT NULL DEFAULT gen_random_uuid(),
    email         varchar(254) NOT NULL,
    password_hash varchar(72)  NOT NULL,
    created_at    timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT buyer_accounts_pk PRIMARY KEY (id),
    CONSTRAINT buyer_accounts_email_uk UNIQUE (email),
    CONSTRAINT buyer_accounts_email_normalized CHECK (email = lower(btrim(email))),
    CONSTRAINT buyer_accounts_email_format CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

CREATE TABLE favorites (
    buyer_id   uuid        NOT NULL,
    product_id uuid        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT favorites_pk PRIMARY KEY (buyer_id, product_id),
    CONSTRAINT favorites_buyer_fk FOREIGN KEY (buyer_id) REFERENCES buyer_accounts (id),
    CONSTRAINT favorites_product_fk FOREIGN KEY (product_id) REFERENCES products (id)
);
