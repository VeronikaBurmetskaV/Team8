-- «Немає на сайті» (ADR-0017, revised 2026-12-01): a card imported from the brand's own site
-- that a COMPLETE run no longer listed. Not a third status: the card stays a Draft (the
-- DRAFT ⇄ PUBLISHED machine is unchanged) with the time it went missing. While it is missing
-- it can't be published (the CHECK below backs the publish UPDATE's own condition); when the
-- site lists it again, the import clears both columns and it is an ordinary Draft.
--
-- removed_from_list_at: «Прибрати зі списку» in the cabinet. The cabinet list also leaves out
-- cards missing for more than 30 days. Nothing is deleted (domain-model.md: no deletion ever).
ALTER TABLE products
    ADD COLUMN missing_since        timestamptz,
    ADD COLUMN removed_from_list_at timestamptz,
    ADD CONSTRAINT products_missing_only_brand_imported
        CHECK (missing_since IS NULL OR (brand_id IS NOT NULL AND external_id IS NOT NULL)),
    ADD CONSTRAINT products_missing_is_draft
        CHECK (missing_since IS NULL OR status = 'draft'),
    ADD CONSTRAINT products_removed_needs_missing
        CHECK (removed_from_list_at IS NULL OR missing_since IS NOT NULL);
