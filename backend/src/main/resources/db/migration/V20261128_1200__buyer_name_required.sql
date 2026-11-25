-- The buyer's name is required at registration from now on (US-02, ADR-0016 revised 2026-11-28).
-- NOT VALID: PostgreSQL enforces the CHECK for every new or changed row but does not check the
-- rows that exist, so accounts created while the name was optional keep working without a
-- made-up default name. Such an old row must get a name before it is updated again.
ALTER TABLE buyer_accounts
    ADD CONSTRAINT buyer_accounts_display_name_required CHECK (display_name IS NOT NULL) NOT VALID;
