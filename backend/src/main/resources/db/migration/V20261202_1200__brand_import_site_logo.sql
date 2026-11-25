-- The logo of a brand's own website, found on its home page during the brand site import
-- (ADR-0017, ADR-0015), like catalog_sources.logo_url of the demo import. Only the URL is kept,
-- the image is never fetched or copied. Read and shown only with fulla.brands.source-logos
-- (application-dev.yml); a logo saved in the profile always comes first.
ALTER TABLE brand_imports
    ADD COLUMN site_logo_url varchar(2048)
        CONSTRAINT brand_imports_site_logo_https
            CHECK (site_logo_url IS NULL OR site_logo_url LIKE 'https://%');
