-- Demo import (ADR-0014, dev only): the URL of the source site's logo, found on its home page.
-- Only the URL is stored, the image is never copied (ADR-0007, ADR-0014). Shown on the brand
-- tile of a single-brand source by GET /api/brands, and only in profile dev (ADR-0015).
ALTER TABLE catalog_sources
    ADD COLUMN logo_url varchar(2048)
        CHECK (logo_url IS NULL OR logo_url LIKE 'https://%');
