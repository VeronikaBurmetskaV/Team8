# ADR-0003: Repository structure — one repo with `backend/`, `frontend/` and a written API contract

## Status
Proposed — 2026-10-28 (revised: Java backend; then simplified: hand-written contract in `docs/contracts/api.md`, no OpenAPI generation)

## Context
ADR-0001 gives a Spring Boot backend and a React frontend that share one contract: endpoints, request/response shapes and error codes. Local start must be as simple as possible after `git clone`, without Docker. Claude Code should see the whole system in one checkout. For a 7-week MVP with a basic-level team, every extra generated artifact is one more thing to keep in sync.

## Options
1. **One repo: `backend/` (Maven Wrapper), `frontend/` (Vite), `docs/contracts/api.md`, root `package.json` with scripts only.**
   + Each pair uses its native tool day to day; one clone; root `npm run dev` starts both; the contract is a document both sides can read.
   − Two build tools in one repo; every laptop needs JDK 21 and Node; FE types are written by hand.
2. **Same, plus a generated contract (springdoc → `openapi.json` → TS types).**
   + Types can't drift from the backend.
   − A generation step, a CI drift check and two generated files to keep current. Postponed.
3. **Two repositories.**
   + Hard ownership boundaries.
   − The contract is copied between repos; two clones; Claude Code sees half the system.

## Decision
Option 1.

```
backend/           Spring Boot app (Maven Wrapper: mvnw, mvnw.cmd)
  src/main/java/ua/fulla/<feature>/
  src/main/resources/db/migration/   Flyway SQL
frontend/          React + Vite + TypeScript (ADR-0013)
  src/api/types.ts                   written by hand from docs/contracts/api.md
docs/contracts/
  api.md           per endpoint: method, path, auth, request JSON, response JSON, error codes, one example
scripts/           cross-platform Node script for the dev start
docs/
package.json       root: scripts only; `workspaces: ["frontend"]` so one `npm install` installs the frontend
```
The contract flows one way: `docs/contracts/api.md` is changed first (in the same PR as the controller), then `frontend/src/api/types.ts`. `docs/contracts/api.md` is written in week 1 by the backend pair from the endpoint list in ADR-0005.

## Consequences
- **Simpler:** nothing is generated; a contract change is a reviewable diff in one Markdown file; FE devs never open Maven, BE devs rarely touch npm.
- **Harder:** FE types can drift from the backend (R-T12). Every API-changing PR must update `api.md` and `types.ts`, and needs one FE and one BE reviewer.
- **Postponed:** OpenAPI generation (springdoc + openapi-typescript). It can be added later without changing endpoints.

## Related stories
Cross-cutting; most visible for US-21, US-21.1, US-02, US-22.1, US-25.1, US-26 (forms whose rules and error codes cross the contract).
