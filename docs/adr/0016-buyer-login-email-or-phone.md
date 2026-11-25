# ADR-0016: Buyer account by email or phone (no SMS check), with a name

## Status
Proposed — 2026-11-27; revised 2026-11-28: the name is required (see «Name»). Extends ADR-0012 (buyer accounts) and US-02; buyer login (US-03) will use the same identifier.

## Context
Many buyers find a phone number easier to type than an email, and the form greets the buyer better with a name. ADR-0012 registers buyers by email only and stores nothing else but the password hash and the liked product IDs (NFR-19). There is no SMS provider in the MVP: no account, no budget (ADR-0010), and sending codes would add an external service.

## Options
1. **Email only (status quo).**
   \+ Nothing to change; one identifier type.
   − Buyers without a handy email, or who prefer the phone, are turned away.
2. **Email or phone in one field, phone not verified; a name (chosen; optional at first, required since 2026-11-28).**
   \+ One field, the server decides what it is; no external service; the stored data stays minimal.
   − Anyone may type someone else's number; there is no password recovery by phone.
3. **Email or phone with SMS verification.**
   \+ Phones are proven.
   − A paid SMS provider, a new integration and a new flow; out of the MVP's budget and time.

## Decision
Option 2:
- `POST /api/buyer/register` takes `{ name, login, password }` (`name` was optional until 2026-11-28). `login` with «@» is an email (strict rule, normalized); otherwise a phone normalized to E.164 — Ukrainian `0XXXXXXXXX` / `380XXXXXXXXX` / `+380XXXXXXXXX` → `+380XXXXXXXXX`, other countries only with «+» and 8–15 digits. The same rules on both sides (`LoginId` / `parseLoginId`), tested with one list of examples.
- `buyer_accounts`: `email` nullable, new `phone` (`UNIQUE`, E.164 CHECK) and `display_name` (≤ 50, nullable); `CHECK (email IS NOT NULL OR phone IS NOT NULL)` — "at least one", so a second identifier can be added later without a migration. Existing accounts keep their email.
- Errors: `400 LOGIN_INVALID` for a malformed login; a taken email **or** phone gives the same neutral `409 EMAIL_TAKEN_OR_INVALID` (no account enumeration); a missing, blank or too long name → `400 VALIDATION_FAILED` with `fields.name`.
- **The phone is not verified by SMS.**

### Name (revised 2026-11-28)
- The name is **required** at registration: 1–50 characters after trimming, not only spaces; missing, blank or longer → `400 VALIDATION_FAILED` with `fields.name`. The form says «Імʼя» (with the Ukrainian apostrophe ʼ) and «Введіть імʼя».
- Migration `V20261128_1200` adds `CHECK (display_name IS NOT NULL) NOT VALID`: PostgreSQL enforces it for every new or changed row and does not check the rows that exist. Accounts created while the name was optional keep working, and none gets a made-up default name. Such an old account must get a name before its row is updated again (e.g. asked once at login, US-03).
- The note under the form now reads «Ми зберігаємо вашу пошту та вподобані товари».

## Consequences
- **Simpler:** buyers can register with what they have; no external service.
- **Harder / risks:** a person can register with someone else's phone number (the owner then cannot use it here); there is **no password recovery by phone** (and none by email yet either, ADR-0006); the phone must not be used for messages until it is verified.
- **Postponed:** SMS verification and recovery; changing or adding a second identifier; login by phone (US-03 will read the same `login` field).

## Related stories
US-02 (registration), US-03 (login, later). ADR-0006, ADR-0012, NFR-19.
