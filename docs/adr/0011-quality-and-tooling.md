# ADR-0011: Quality and tooling — minimal CI

## Status
Proposed — 2026-10-28 (revised: Java backend; then simplified: minimal CI, no contract generation or Java formatter check)

## Context
Six people and Claude Code will write code in parallel for 7 weeks, in two languages. The risks are API types drifting from the backend, validation rules that diverge between Java and the frontend, and regressions in the few rules the stories specify exactly (UTM, validation texts, idempotent like/skip, favourites merge). Docker is not available everywhere, so tests can't depend on it. A basic-level team needs CI that is quick to set up and easy to keep green.

## Options
1. **Minimal CI: `./mvnw verify` (JUnit 5 + MockMvc on embedded Postgres) + frontend lint, typecheck, test (Vitest).**
   + Real Postgres in tests with no Docker; one workflow file; about half a day of setup.
   − No automatic contract or formatting checks; those rely on review.
2. **Option 1 + contract generation drift check + Spotless formatting check.**
   + More automated guarantees.
   − More setup and more ways for CI to be red for reasons unrelated to features. Postponed.
3. **No automation; manual testing before the demo.**
   + Zero setup.
   − Breakages are found in week 7.

## Decision
Option 1.
- **Backend:** JUnit 5, `@SpringBootTest` + MockMvc, zonky `embedded-database-spring-test` (embedded Postgres, no Docker). Repository tests run the real SQL.
- **Frontend:** Vitest; `tsc --noEmit` (strict, ADR-0013); ESLint + Prettier.
- **Must-have tests:**
  - backend: registration race (two parallel inserts → one 409), publish gate (no consent → refused), favourites merge (overlap, double like, retry), `@HttpUrl` and email rules, a CSRF/401 smoke test, JSON field names matching the `docs/contracts/api.md` examples;
  - frontend: `withUtm`, like/skip reducer (US-10 S2), form schemas checked against the same examples as the Java validation tests.
- **CI (GitHub Actions) on every PR to `main`:** `setup-java` 21 (Maven cache) + `setup-node`; `./mvnw verify`; in `frontend/`: lint, typecheck, test. `main` requires green CI and one review.
- **Review checklist** (PR template): `api.md` and `types.ts` updated if the API changed; new error code has a Ukrainian text; no new dependency without checking the ADRs.
- Add a root `CLAUDE.md` in week 1 with the folder rules from ADR-0001/0003 and the same checklist, so Claude Code follows it.

## Consequences
- **Simpler:** one short workflow; CI fails only on broken builds, tests, types and lint.
- **Harder:** contract drift and Java formatting are caught by review and by the MockMvc JSON tests, not by a dedicated check (R-T12).
- **Postponed:** contract drift check (with OpenAPI generation, ADR-0005), Spotless, Playwright E2E, coverage targets.

## Related stories
US-02, US-03, US-09, US-10, US-19, US-21, US-25.1, US-26, US-31, US-32.
