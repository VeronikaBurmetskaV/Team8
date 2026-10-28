# ADR-0005: Backend — Spring Boot 3, REST/JSON, Bean Validation, error envelope, OpenAPI contract

## Status
Proposed — 2026-10-28 (revised the same day: backend language changed to Java)

## Context
Two backend developers with basic Java from university courses. The stories contain exact validation rules and exact Ukrainian error texts (US-21 S2, US-02 S2, US-03 S2, US-21.1 S2, US-22.1 S2, US-25.1 S2, US-26 S2, US-31 S2). The frontend (TypeScript, ADR-0013) needs typed access to the API without hand-written types.

## Options
1. **Spring Boot 3 (Java 21) + Bean Validation + `@RestControllerAdvice` envelope + springdoc-openapi → openapi-typescript.**
   + The most familiar Java stack; the contract is generated, not written by hand.
   − Heavier startup and memory (matters on Render, ADR-0010); validation rules are also written in the frontend.
2. **Javalin + hand-made validation + manual OpenAPI.**
   + Small and explicit; fast startup.
   − Security, sessions, validation and docs assembled by hand.
3. **Micronaut or Quarkus.**
   + Fast startup, low memory.
   − Less familiar; fewer examples; Claude Code is less reliable with them.

## Decision
Option 1. Use the latest Spring Boot 3.x on Java 21 LTS. Check its OSS support status at setup; if 3.x is out of support, use Boot 4, which changes nothing else here.
- **Endpoints (unchanged by the language switch):** `POST /api/brand/register|login|logout`, `GET/PUT /api/brand/profile`, `GET/POST /api/brand/products`, `PUT /api/brand/products/{id}`, `POST /api/brand/products/{id}/publish|unpublish`, `GET /api/feed`, `GET /api/products?ids=…`, `POST /api/images`, `GET /api/images/{id}`, `POST /api/buyer/register|login|logout`, `GET/POST /api/me/favorites` (ADR-0012).
- **Validation:** Bean Validation on request records (`@NotBlank`, `@Size`, `@Email` with a stricter `name@domain.tld` pattern (US-02, US-21), custom `@HttpUrl` (US-26)). The backend is the authority; the frontend repeats the rules for instant feedback.
- **Errors:** `{ "error": { "code", "message", "fields"? } }` from one `@RestControllerAdvice`. `code` is a Java enum exported in OpenAPI: `EMAIL_TAKEN_OR_INVALID`, `INVALID_CREDENTIALS`, `PROFILE_INVALID`, `CARD_INVALID_PRICE_OR_PHOTO`, `CARD_INVALID_URL`, `PUBLISH_FIELDS_MISSING`, `CONSENT_REQUIRED`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `SERVICE_UNAVAILABLE`, … `message` is developer-facing English. **Ukrainian UI texts live only in `frontend/src/shared/messages.uk.ts`, keyed by `code`.**
- HTTP status: 400 validation, 401 no session, 403 not owner (INV-07) or CSRF, 404, 409 conflict (email taken, invalid state transition), 503 DB unavailable.
- **Contract:** springdoc generates the spec. A backend test writes it to `contract/openapi.json`; `scripts/gen-api` runs `openapi-typescript` → `frontend/src/api/schema.d.ts`. Both files are committed (ADR-0003).

## Consequences
- **Simpler:** FE gets typed endpoints and a typed `ErrorCode` union; a UI text is changed in one frontend file; FE can mock from the committed contract before the endpoint exists.
- **Harder:** every rule is written twice (Java + frontend form schema), so drift is a risk (R-T17). The team must keep REST naming discipline.
- **Postponed:** API versioning, rate limits beyond login/register (ADR-0006).

## Related stories
US-21, US-21.1, US-02, US-03, US-22.1, US-22.2, US-25.1, US-26, US-31 (validation/errors); US-08.1, US-16 (read endpoints).
