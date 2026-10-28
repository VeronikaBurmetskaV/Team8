# ADR-0009: Consistency and concurrency rules

## Status
Proposed — 2026-10-28 (revised the same day: Java implementation notes; the rules themselves are unchanged)

## Context
Six places where timing or repetition can break an invariant:
- the same email registered twice at once (US-21, US-02, NFR-04);
- a double click or a swipe plus a click on one card (US-09, US-10 S2; INV-04, INV-05);
- a registered buyer's favourites arriving from several devices or retries (ADR-0012);
- a card published or unpublished while a buyer is mid-feed (US-31, NFR-07; A-10, A-11);
- publishing without consent or required fields (BR-48, INV-02);
- product link correctness (US-26, A-15, A-16).

## Options
1. **Let the DB or a pure function enforce each invariant; the UI only mirrors it.**
   + Holds no matter which client, tab or timing.
   − Needs DB-level constraints and careful SQL.
2. **UI-level guards (disable buttons, debounce, client checks).**
   + Fast to build.
   − Timing-dependent; bypassed by a second tab or a direct API call.
3. **Real-time sync (SSE/WebSocket) for feed changes.**
   + Truly instant feed updates.
   − New infrastructure; free hosts sleep; no requirement needs sub-second updates.

## Decision
Option 1, with UI guards added only for UX. SQL runs through `JdbcClient` (ADR-0004).

| Case | Rule |
|---|---|
| Unique email | Email normalized (trim, lower-case) **before** insert; `UNIQUE` index per account table. Spring's `DuplicateKeyException` (SQLState `23505`) → `EMAIL_TAKEN_OR_INVALID` (409); form data kept (US-21 S2, US-02 S2). |
| Like/skip | Actions keyed by card ID: the reducer ignores `like(id)`/`skip(id)` if `id ∈ viewedIds`; `favoriteIds` is a set; input locked until the next card is current. The second «Пропустити» of US-10 S2 hits card #5 again and is ignored. Not timing-based. |
| Favourites of a registered buyer | `PRIMARY KEY (buyer_id, product_id)` + `INSERT … ON CONFLICT DO NOTHING` (one batch statement per request). Merge on login = set union, safe because favourites are append-only (no US-17). Failed syncs are retried by re-sending the set (ADR-0012). |
| Feed order | `GET /api/feed` returns published cards ordered by `published_at, id`. The client shows the first card not in `viewedIds` (or `favoriteIds`). TanStack Query refetches on window focus and when < 3 unviewed cards remain. A newly published card appears at the end; a republished card that was already viewed is not shown again. |
| Unpublished mid-session | A card already on screen stays actionable. «Вподобане» loads `GET /api/products?ids=…`, which returns current data + `available` for every ID (unpublished cards included, public fields only). `available=false` → inactive «Тимчасово недоступно на сайті бренду» (US-19 S2). |
| Publish gate | `UPDATE products SET status='published', published_at=now() WHERE id=? AND brand_id=? AND status='draft' AND EXISTS (consent given for brand)`. 0 rows → re-read to return `CONSENT_REQUIRED` / `PUBLISH_FIELDS_MISSING` / 409. Drafts are complete by construction (US-25.1, US-26; US-31 S2). |
| Card edits in two tabs | Last write wins. Published cards are read-only (A-06), so only drafts are exposed. No card deletion (US-31). |
| Product link | Format only: `@HttpUrl` Bean Validation (parse with `java.net.URI`, scheme `http`/`https`, non-empty host) on the API, and the same rule in the frontend form schema. No server-side fetch. `withUtm(url)` (frontend) adds `utm_source=fulla` with `&` if a query exists, before any `#fragment`, and leaves the URL untouched if `utm_source` already exists. |

## Consequences
- **Simpler:** invariants are testable as frontend unit tests (reducer, `withUtm`) and backend tests on embedded Postgres (unique index, publish SQL, merge SQL).
- **Harder:** the "favourites by IDs" endpoint must expose unpublished cards' public fields; the URL rule exists in Java and TypeScript (R-T17); UI guards are not the protection.
- **Postponed:** real-time feed push, optimistic locking, link reachability checks (`architecture/integrations.md`).

## Related stories
US-21, US-02, US-03, US-09, US-10, US-16, US-19, US-26, US-31, US-32.
