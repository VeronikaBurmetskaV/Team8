# Architecture Decision Records

Short records of decisions that are expensive to reverse. Options and ratings are in [`../analysis/options.md`](../analysis/options.md); the ADR only fixes the choice.

## Index

| ADR | Title | Status |
|---|---|---|
| [0001](0001-architecture-style.md) | Architecture style: React SPA served by a Spring Boot API, package-by-feature | Proposed |
| [0002](0002-platform-responsive-web.md) | Platform: responsive mobile-first web | Proposed |
| [0003](0003-repository-structure.md) | Repository structure: `backend/`, `frontend/`, contract in `docs/contracts/api.md` | Proposed |
| [0004](0004-postgres-embedded-neon-jdbcclient.md) | Postgres (Neon deployed, embedded locally) + Flyway + `JdbcClient` | Proposed |
| [0005](0005-backend-spring-boot-rest.md) | Backend: Spring Boot 3, REST, Bean Validation, error envelope, hand-written contract | Proposed |
| [0006](0006-auth-spring-security-sessions.md) | Auth: Spring Security, BCrypt, in-memory sessions, one cookie | Proposed |
| [0007](0007-image-storage-in-db.md) | Image storage in Postgres behind `ImageStore` | Proposed |
| [0008](0008-frontend-stack.md) | Frontend stack | Proposed |
| [0009](0009-consistency-and-concurrency.md) | Consistency and concurrency rules | Proposed |
| [0010](0010-deployment-and-hosting.md) | Deployment: local demo; Render + Neon optional | Proposed |
| [0011](0011-quality-and-tooling.md) | Quality and tooling: minimal CI | Proposed |
| [0012](0012-buyer-accounts-favorites-sync.md) | Buyer accounts and moving «Вподобане» to the server | Proposed |
| [0013](0013-frontend-language-typescript.md) | Frontend language: TypeScript (strict) | Proposed |

Status flow: **Proposed** → **Accepted** (the team lead marks it after team review) → **Superseded by ADR-NNNN** (never edit an accepted decision; write a new ADR). While an ADR is Proposed, it is revised in place, with a note in its Status line.

## When to write an ADR

Write one when **at least one** is true:

- reversing it later would take more than ~1 day of work or touch both `backend/` and `frontend/`;
- it adds an external service, an account, or a runtime/tool that every developer must install;
- it changes a shared contract: DB schema conventions, API/error format, `docs/contracts/api.md`;
- it resolves a gap from `requirements-digest.md` in a way that affects code (e.g. "Favorites are references");
- two team members disagreed and the answer must not be re-argued.

Do **not** write one for:

- a library that sits inside one feature package/folder and is easy to swap (date formatting, an icon set);
- naming, formatting, structure inside a feature (lint/format config and code review cover those);
- UI/visual decisions (those belong to the designer's files);
- anything already fixed by an existing ADR. Link to it instead.

## Format

```
# ADR-NNNN: Title
Status | Context | Options (with pros/cons) | Decision | Consequences | Related stories
```

At most one page. 2–3 options. Consequences say what becomes **simpler**, what becomes **harder**, and what is **postponed**.
