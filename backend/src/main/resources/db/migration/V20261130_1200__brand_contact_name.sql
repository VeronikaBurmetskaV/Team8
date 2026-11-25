-- The brand's contact person («Ваше імʼя», US-21): entered at registration, editable in the
-- profile («Контактна особа»). On brand_profiles, next to the other data the brand fills in
-- and edits (name, website); brand_accounts keeps only the login data (email, password hash).
--
-- Nullable, no default: brands registered before this migration have no contact name, and a
-- made-up value would look like real data. Registration requires it (Bean Validation,
-- @DisplayName(required = true)); a profile save without it keeps the stored value, so the
-- old rows keep working and get a name when the brand fills in «Контактна особа».
ALTER TABLE brand_profiles
    ADD COLUMN contact_name varchar(50)
        CONSTRAINT brand_profiles_contact_name_length
            CHECK (contact_name IS NULL OR char_length(btrim(contact_name)) BETWEEN 1 AND 50);
