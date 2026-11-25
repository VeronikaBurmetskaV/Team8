-- Buyer registration by email OR phone, with an optional name (US-02, ADR-0016).
-- Existing accounts all have an email, so the new CHECK holds for them.
ALTER TABLE buyer_accounts
    ALTER COLUMN email DROP NOT NULL,
    ADD COLUMN phone varchar(16),
    ADD COLUMN display_name varchar(50),
    -- E.164; the server normalizes before every insert (LoginId).
    ADD CONSTRAINT buyer_accounts_phone_format CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{7,14}$'),
    ADD CONSTRAINT buyer_accounts_phone_uk UNIQUE (phone),
    -- At least one way to log in; both may exist later (a phone added to an email account).
    ADD CONSTRAINT buyer_accounts_login_present CHECK (email IS NOT NULL OR phone IS NOT NULL),
    ADD CONSTRAINT buyer_accounts_display_name_length
        CHECK (display_name IS NULL OR char_length(btrim(display_name)) BETWEEN 1 AND 50);
