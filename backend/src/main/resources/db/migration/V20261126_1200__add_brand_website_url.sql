-- The brand's website (US-21, US-22.1): entered at registration and in the profile. Stored
-- only; the server never requests it (A-15). https:// only, like logo_url.
ALTER TABLE brand_profiles
    ADD COLUMN website_url varchar(2048)
        CONSTRAINT brand_profiles_website_url_https
            CHECK (website_url IS NULL OR website_url LIKE 'https://%');
