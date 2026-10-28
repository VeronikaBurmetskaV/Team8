# ADR-0004: Postgres — Neon deployed, embedded Postgres locally — with Flyway and Spring `JdbcClient`

## Status
Proposed — 2026-10-28 (revised the same day: backend language changed to Java)

## Context
Docker is not available on every laptop, so the local DB must start from the build itself. No bank card, so the deployed DB must be a no-card free tier. Bugs that appear only in production are the most expensive kind for a 7-week project, so local and deployed must use the same SQL dialect.
Data: brand and buyer accounts, sessions, profiles with consent, product cards, favourites (ADR-0012), images (ADR-0007). The invariants are SQL statements (ADR-0009): a unique email under concurrency, a conditional publish `UPDATE`, `INSERT … ON CONFLICT DO NOTHING`, and `bytea` storage.
The team's preference was **Spring Data JPA**.

## Options
1. **Spring Data JPA + Flyway; Neon + embedded Postgres.**
   + Fastest CRUD; most tutorials.
   − All three critical operations need native `@Modifying @Query` anyway. Pitfalls a basic team hits quickly: `@Lob byte[]` maps to Postgres `oid`, not `bytea`; lazy loading/N+1; open-session-in-view; dirty checking writes at unexpected times.
2. **Spring `JdbcClient` + Flyway; Neon + embedded Postgres.**
   + Plain SQL, as taught in JDBC courses; each invariant is one visible statement; `byte[]` ↔ `bytea` works directly; nothing happens implicitly.
   − Hand-written `RowMapper`s/records for ~7 tables (Claude Code writes them; reviewers can still read them).
3. **H2 in PostgreSQL mode locally + JPA.**
   + Zero setup.
   − Dialect gaps (`ON CONFLICT`, `bytea`): ADR-0009's SQL would work only in production.

## Decision
Option 2. **This disagrees with the team's JPA preference.** Our critical logic is SQL, so JPA would add a layer we bypass exactly where correctness matters, plus pitfalls the team would meet in week 2. If the team strongly prefers JPA for simple CRUD, it may be added later for those tables only. The three critical operations stay `JdbcClient` either way.
- Local: profile `dev` starts zonky `embedded-postgres` (same Postgres major as the Neon project) with a persistent data directory `backend/.data/pg` (git-ignored) and a fixed port. Deployed (optional step, ADR-0010): `SPRING_DATASOURCE_URL` points to Neon.
- Flyway migrations in `backend/src/main/resources/db/migration`, versioned by timestamp (`V20261103_1200__create_products.sql`) to avoid collisions between two devs.
- A seeder that runs only in `dev`, and only when the DB is empty: ≥ 4 brands, ~30 cards (R-P04).
- Conventions: `snake_case` tables, `uuid` PKs, `created_at`/`updated_at` as `timestamptz` (UTC), price as `integer` UAH (A-13), repository classes return Java records.

## Consequences
- **Simpler:** no Docker; deleting `backend/.data` resets everything; tests use the same embedded Postgres (ADR-0011); SQL in code = SQL in review.
- **Harder:** more mapping code than JPA. Renaming a column means touching SQL strings, which repository tests catch (R-T16). The embedded Postgres download (~tens of MB) happens on the first run.
- **Postponed:** JPA/ORM, connection pool tuning, backups (Neon free keeps a short history).

## Related stories
US-21, US-02 (unique email), US-22.1, US-22.2 (consent record, A-17), US-25.1, US-26, US-31, US-03 (favourites merge).
