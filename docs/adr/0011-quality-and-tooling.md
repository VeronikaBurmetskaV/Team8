# ADR-0011: Quality and tooling

## Status
Proposed — 2026-10-28 (revised the same day: backend language changed to Java)

## Context
Six people and Claude Code will write code in parallel for 7 weeks, in two languages. The risks are contract drift between `backend/` and `frontend/`, validation rules that diverge between Java and the frontend, inconsistent generated code, and regressions in the few rules the stories specify exactly (UTM, validation texts, idempotent like/skip, favourites merge). Docker is not available everywhere, so tests can't depend on it.

## Options
1. **JUnit 5 + Spring Boot Test + MockMvc on embedded Postgres; Vitest; Spotless + ESLint/Prettier; GitHub Actions with a contract drift check.**
   + Real Postgres in tests with no Docker; one CI run covers both apps and the contract.
   − About 1 day of setup in week 1; CI is slower than a single-language project.
2. **Same, with Testcontainers for backend tests.**
   + The industry default.
   − Needs Docker locally; not every laptop has it.
3. **No automation; manual testing before the demo.**
   + Zero setup.
   − Breakages are found in week 7.

## Decision
Option 1.
- **Backend:** JUnit 5, `@SpringBootTest` + MockMvc, zonky `embedded-database-spring-test` (embedded Postgres, no Docker). Repository tests run the real SQL.
- **Frontend:** Vitest; `tsc --noEmit` (strict, ADR-0013); ESLint + Prettier.
- **Java formatting:** Spotless (google-java-format), `spotless:check` in CI.
- **Must-have tests:**
  - backend: registration race (two parallel inserts → one 409), publish gate (no consent → refused, 0 rows), favourites merge (overlap, double like, retry), `@HttpUrl` and email rules, a CSRF/401 smoke test;
  - frontend: `withUtm`, like/skip reducer (US-10 S2), form schemas against the same examples as the Java validation tests.
- **CI (GitHub Actions) on every PR to `main`:** `setup-java` 21 (Maven cache) + `setup-node`; `./mvnw verify`; frontend lint, typecheck, test; **contract drift check** (regenerate `contract/openapi.json` and `frontend/src/api/schema.d.ts`, then `git diff --exit-code`). `main` requires green CI and one review.
- Add a root `CLAUDE.md` in week 1 with the folder rules from ADR-0001/0003, "no new dependency without checking the ADRs", and "regenerate the contract after API changes".
- One Playwright smoke test (start → like → favourites → brand link) if time allows in week 6.

## Consequences
- **Simpler:** contract drift, stale generated types and broken rules are caught on the PR, not at the demo.
- **Harder:** PRs take longer; whoever changes the API also regenerates the contract; someone must fix a red CI the same day.
- **Postponed:** full E2E suite, coverage targets, visual regression.

## Related stories
US-02, US-03, US-09, US-10, US-19, US-21, US-25.1, US-26, US-31, US-32.
