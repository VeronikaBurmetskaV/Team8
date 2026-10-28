# ADR-0005: Backend — Spring Boot 3, REST/JSON, Bean Validation, error envelope, hand-written contract

## Status
Proposed — 2026-10-28 (revised: Java backend; then simplified: contract in `docs/contracts/api.md`, OpenAPI generation postponed)

## Context
Two backend developers with basic Java from university courses. The stories contain exact validation rules and exact Ukrainian error texts (US-21 S2, US-02 S2, US-03 S2, US-21.1 S2, US-22.1 S2, US-25.1 S2, US-26 S2, US-31 S2). The frontend (TypeScript, ADR-0013) needs to know endpoint shapes and error codes. For a 7-week MVP, tooling that generates and checks artifacts costs more than it saves.

## Options
1. **Spring Boot 3 (Java 21) + Bean Validation + `@RestControllerAdvice` envelope; contract written by hand in `docs/contracts/api.md`.**
   + The most familiar Java stack; no generation step; the contract is readable by the whole team, including the designer and lead.
   − FE types are hand-written and can drift (R-T12); validation rules are also written in the frontend.
2. **Same, with springdoc-openapi → openapi-typescript generated types.**
   + Types can't drift.
   − Generation step, committed generated files, CI drift check. Postponed.
3. **Micronaut or Quarkus / Javalin.**
   + Faster startup, less memory (Micronaut/Quarkus) or more explicit (Javalin).
   − Less familiar; fewer examples; security and validation assembled by hand (Javalin).

## Decision
Option 1. Use the latest Spring Boot 3.x on Java 21 LTS. Check its OSS support status at setup; if 3.x is out of support, use Boot 4, which changes nothing else here.
- **Endpoints:** `POST /api/brand/register|login|logout`, `GET/PUT /api/brand/profile`, `GET/POST /api/brand/products`, `PUT /api/brand/products/{id}`, `POST /api/brand/products/{id}/publish|unpublish`, `GET /api/feed`, `GET /api/products?ids=…`, `POST /api/images`, `GET /api/images/{id}`, `POST /api/buyer/register|login|logout`, `GET/POST /api/me/favorites` (ADR-0012).
- **Contract:** `docs/contracts/api.md` describes each endpoint: method, path, auth, request JSON, response JSON, error codes, one example. It is the source for `frontend/src/api/types.ts`. A PR that changes a controller also changes `api.md`.
- **Validation:** Bean Validation on request records (`@NotBlank`, `@Size`, `@Email` with a stricter `name@domain.tld` pattern (US-02, US-21), custom `@HttpUrl` (US-26)). The backend is the authority; the frontend repeats the rules for instant feedback.
- **Errors:** `{ "error": { "code", "message", "fields"? } }` from one `@RestControllerAdvice`. `code` is a Java enum listed in `api.md`: `EMAIL_TAKEN_OR_INVALID`, `INVALID_CREDENTIALS`, `PROFILE_INVALID`, `CARD_INVALID_PRICE_OR_PHOTO`, `CARD_INVALID_URL`, `PUBLISH_FIELDS_MISSING`, `CONSENT_REQUIRED`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `SERVICE_UNAVAILABLE`, … `message` is developer-facing English. **Ukrainian UI texts live only in `frontend/src/shared/messages.uk.ts`, keyed by `code`.**
- HTTP status: 400 validation, 401 no session, 403 not owner (INV-07) or CSRF, 404, 409 conflict (email taken, invalid state transition), 503 DB unavailable.
- MockMvc tests assert the JSON field names of the `api.md` examples, so the backend can't silently diverge from the document.

## Consequences
- **Simpler:** no generator, no generated files, no drift check in CI; the contract doubles as API documentation for the demo.
- **Harder:** FE types and `api.md` are kept in sync by hand and by review (R-T12); every rule is written twice, in Java and in the frontend form schema (R-T17).
- **Postponed:** OpenAPI/springdoc and generated TS types, API versioning, rate limits beyond login/register (ADR-0006).

## Related stories
US-21, US-21.1, US-02, US-03, US-22.1, US-22.2, US-25.1, US-26, US-31 (validation/errors); US-08.1, US-16 (read endpoints).
