# CLAUDE.md — FULLA

Instructions for AI coding assistants (Claude Code and others) working in this repository.
Read this file fully before writing code. When this file and a source document disagree, **the source document wins**: fix your understanding, not the document, and tell the human about the mismatch.

**Sources of truth (read-only for assistants unless a human explicitly asks for a change):**

| What | Where |
|---|---|
| Scope, journeys, story map | [`docs/requirements.md`](docs/requirements.md), [`user stories/`](user%20stories/UserStoriesREADME.md) |
| Business rules, NFRs, assumptions (BR-, NFR-, INV-, A-, G- IDs) | [`docs/analysis/requirements-digest.md`](docs/analysis/requirements-digest.md) |
| Binding technology and architecture decisions | [`docs/adr/`](docs/adr/README.md) — ADR-0001…0013 |
| System overview, components, routes, open questions (Q-01…Q-13) | [`docs/architecture/overview.md`](docs/architecture/overview.md) |
| Entities, invariants, state machines | [`docs/architecture/domain-model.md`](docs/architecture/domain-model.md) |
| HTTP contract, error envelope, error codes | [`docs/architecture/api.md`](docs/architecture/api.md) (→ `docs/contracts/api.md`, see §5.2) |
| Tables, columns, constraints, transactional invariants (T-1…T-14) | [`docs/architecture/data-model.md`](docs/architecture/data-model.md) |
| External links/infra, what the server must never call | [`docs/architecture/integrations.md`](docs/architecture/integrations.md) |
| Risks and their mitigations (R-T, R-P, R-M) | [`docs/architecture/risks.md`](docs/architecture/risks.md) |

> **Current state (28.10.2026):** documentation only. No `backend/`, `frontend/`, `scripts/` or `package.json` exist yet. Everything in §3–§4 is the **target** defined by the ADRs; the walking skeleton creates it. Do not describe target names as if they already exist, and do not scaffold them unless the task asks for it.

---

## 1. Project identity

### 1.1. What FULLA is

FULLA is a **mobile-first, swipe-based discovery catalogue of Ukrainian clothing brands**, delivered as one responsive web app with two halves:

- **Buyer side (anonymous by default).** A buyer opens a link on a phone, sees the start page, presses «Почати шопінг» and goes **straight** to the swipe feed — no registration, no settings (BR-03, NFR-01). Swipe right / «Подобається» saves a card to «Вподобане»; swipe left / «Пропустити» skips it (gesture and button are equivalent, BR-11). «Вподобане» lists liked items with current data; «Перейти на сайт бренду» opens the brand's product page **in a new tab** with `utm_source=fulla` (US-19, US-32). Purchase, payment and delivery happen **only** on the brand's site (INV-06).
  - Two shopping modes are served by the same flow: **exploratory** (persona Софія, discovering new brands) and **pragmatic** (persona Максим, quickly finding a concrete item).
  - Anonymous state (`viewedIds`, `favoriteIds`) lives in browser localStorage. An **optional** buyer account (US-02, US-03) moves «Вподобане» to the server and merges it by set union (ADR-0012). Registration is offered from «Вподобане» and navigation only — **never in front of the feed**.
- **Brand cabinet (authenticated).** A brand owner registers with email + password (US-21), logs in/out (US-21.1), fills the brand name and optional logo (US-22.1), gives the explicit consent (US-22.2), creates product cards by hand (US-25.1), previews them in the exact feed template (US-25.2), checks the product link (US-26), and publishes/unpublishes cards (US-31).

### 1.2. Scope boundaries

Only **In Scope** stories are requirements. Each has a file in `user stories/` with Gherkin scenarios (S1 happy path, S2 edge case) and a business-rule checklist (CL).

| Side | In Scope (MVP, 19 stories) |
|---|---|
| Buyer | US-01.1, US-01.2, US-02, US-03, US-08.1, US-08.2, US-09, US-10, US-16, US-19 |
| Brand | US-21, US-21.1, US-22.1, US-22.2, US-25.1, US-25.2, US-26, US-31, US-32 |

**Out of Scope — do not implement, do not add fields, endpoints or UI for them:**

| Story | What is excluded | Consequence for code |
|---|---|---|
| US-04…US-07 | Categories, size, brand selection, feed settings | One shared catalogue; no filter params on `GET /api/feed` |
| US-11 | Distribution rules for new/small brands | Feed order is `published_at, id` only |
| US-12 | "Back" to the previous card | Like/skip is final on the device |
| US-13…US-15 | Card flip, composition, sizes, size chart | Card = name, brand name, price, photo, product URL — nothing else |
| US-17 | Remove from «Вподобане» | Favourites are **append-only** (the merge-by-union design depends on it) |
| US-18 | Compare favourites | — |
| US-20 | Brand page / brand link | Brand name is text on the card; logo is never shown to buyers |
| US-23, US-24, US-27…US-30 | Site connection, import, sync of stock/prices, auto-unpublish | Cards are created manually; the server **never** fetches brand URLs (A-15) |

Also out of the MVP (ADRs, "Postponed"): password reset by email, email verification, social login, 2FA, PWA/offline, i18n beyond Ukrainian, real-time feed push, moderation, click tracking, OpenAPI generation, Spring Session JDBC, public hosting, Playwright E2E, Spotless.

---

## 2. Architecture and technology stack

### 2.1. Architectural style (ADR-0001)

**One React SPA served by one Spring Boot API on one origin; package-by-feature on both sides.**

- No separate deployments, no CORS, no microservices, no hexagonal/clean layering. The single deliberate abstraction is the `ImageStore` interface (ADR-0007). **Do not add other interfaces "for the future".**
- In development, Vite (`:5173`) proxies `/api` to Spring (`:8080`) so the browser still sees one origin (ADR-0010).
- A story maps to one backend feature package and one frontend feature folder.

### 2.2. Stack (only what the ADRs fix)

| Concern | Decision | ADR |
|---|---|---|
| Platform | Responsive, mobile-first web (buyer 320–430 px first, from 320 px with no horizontal scroll; cabinet desktop-first but works on mobile). No native app, no PWA | 0002 |
| Backend language / runtime | **Java 21 LTS** (Temurin), `maven.compiler.release=21` | 0005, 0010 |
| Backend framework | **Spring Boot 3.x** (latest; Boot 4 only if 3.x is out of OSS support at setup), Spring Web (REST/JSON), Bean Validation, Maven Wrapper (`mvnw`, `mvnw.cmd`) | 0005, 0003 |
| Data access | **Spring `JdbcClient`** with hand-written SQL; repositories return Java records. **No JPA/Hibernate** | 0004 |
| Database | **PostgreSQL**: zonky `embedded-postgres` locally (profile `dev`, data in `backend/.data/pg`, fixed non-default port); Neon free tier only in the optional deploy | 0004, 0010 |
| Migrations | **Flyway**, SQL files in `backend/src/main/resources/db/migration`, timestamp versions | 0004 |
| Authentication | **Spring Security**, `BCryptPasswordEncoder`, default **in-memory `HttpSession`**, one cookie `FULLA_SESSION` (`HttpOnly`, `SameSite=Lax`, 30 days), roles `ROLE_BRAND` / `ROLE_BUYER`, **CSRF on** via cookie token (`XSRF-TOKEN` cookie → `X-XSRF-TOKEN` header) | 0006 |
| Images | Uploaded bytes in Postgres `bytea` behind `ImageStore`; PNG/JPG/WEBP by magic bytes, ≤ 5 MB; external `https://` image URLs stored as-is | 0007 |
| Frontend language | **TypeScript `strict`** | 0013 |
| Frontend stack | **React + Vite**, React Router, TanStack Query, small typed `fetch` client, CSS Modules + designer tokens as CSS variables, `motion` (swipe), Zustand with `persist` → localStorage, react-hook-form + zod | 0008 |
| Tests | Backend: JUnit 5, `@SpringBootTest` + MockMvc, zonky `embedded-database-spring-test` (no Docker). Frontend: Vitest, `tsc --noEmit`, ESLint + Prettier | 0011 |
| CI | GitHub Actions on every PR to `main`: `setup-java` 21 + `setup-node`; `./mvnw verify`; frontend lint, typecheck, test | 0011 |
| Deployment | **Local laptop demo.** Phone on the same Wi-Fi via Vite `--host`; `cloudflared` quick tunnel for a temporary link. Render + Neon (multi-stage Dockerfile) is a documented **optional** step, not planned | 0010 |

All ADRs are currently **Proposed**. Never edit an ADR to fit code; if a decision must change, a human writes a new ADR (see `docs/adr/README.md`).

### 2.3. Approved dependencies (allow-list)

Adding anything not on this list requires a human decision (and an ADR if it meets the criteria in `docs/adr/README.md`). Say so in the PR instead of adding it.

- **Backend:** `spring-boot-starter-web`, `spring-boot-starter-validation`, `spring-boot-starter-security`, `spring-boot-starter-jdbc` (`JdbcClient`), `flyway-core` (+ `flyway-database-postgresql` if the Flyway version requires it), PostgreSQL JDBC driver, `io.zonky.test:embedded-postgres` (dev profile), `spring-boot-starter-test`, `spring-security-test`, `io.zonky.test:embedded-database-spring-test`.
- **Frontend:** `react`, `react-dom`, `react-router` / `react-router-dom`, `@tanstack/react-query`, `zustand`, `motion`, `react-hook-form`, `zod` (+ `@hookform/resolvers`), `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `eslint` (+ TS/React plugins), `prettier`; `@fontsource/*` only if the design uses web fonts (no font CDN).
- **Explicitly not approved:** JPA/Hibernate/Spring Data JPA, Lombok, MapStruct, springdoc/OpenAPI generators, axios, Redux, Tailwind, Mantine or any component library, Spring Session, JWT libraries, Docker/Testcontainers, H2, Cloudinary SDK, Thumbnailator, any HTTP client used to call brand sites.

---

## 3. Target repository structure (ADR-0003, ADR-0001, overview §4)

```
/
├── CLAUDE.md                     this file
├── README.md                     project description; start guide (Ukrainian)
├── package.json                  root: scripts only; "workspaces": ["frontend"]
├── package-lock.json             committed
├── .nvmrc                        Node LTS version
├── scripts/
│   └── dev.mjs                   cross-platform dev start: checks `java -version`, runs mvnw/mvnw.cmd (profile dev) + Vite
├── backend/                      Spring Boot app (owned by the backend pair)
│   ├── mvnw, mvnw.cmd, .mvn/     Maven Wrapper
│   ├── pom.xml
│   ├── .data/pg/                 embedded Postgres data dir (git-ignored; delete to reset the DB)
│   └── src/
│       ├── main/java/ua/fulla/
│       │   ├── common/           error envelope (@RestControllerAdvice), ErrorCode enum, SecurityConfig
│       │   │                     (roles, CSRF, session cookie), web config, GET /api/session, SPA forward
│       │   ├── brandauth/        brand register/login/logout; creates the empty profile (US-21, US-21.1)
│       │   ├── brandprofile/     name, logo, one-way consent (US-22.1, US-22.2)
│       │   ├── products/         draft CRUD, publish/unpublish gate — the ONLY code that changes card status
│       │   │                     (US-25.1, US-26, US-31)
│       │   ├── feed/             public reads: GET /api/feed, GET /api/products?ids= (US-08.1, US-16, US-19)
│       │   ├── images/           ImageStore + upload (magic bytes) + immutable serving (ADR-0007)
│       │   ├── buyer/            buyer accounts + idempotent favourites (US-02, US-03, ADR-0012)
│       │   └── ops/              profile `ops` only: reset-password, consent withdrawal (ADR-0006, R-P10)
│       │                         (+ a dev-profile seeder: ≥ 4 brands, ~30 cards, only when the DB is empty)
│       ├── main/resources/
│       │   ├── application.yml (+ application-dev.yml, application-ops.yml, application-prod.yml)
│       │   └── db/migration/     Flyway SQL: V20261103_1200__create_products.sql
│       └── test/java/ua/fulla/   JUnit 5 + MockMvc + embedded Postgres, mirrored per feature
├── frontend/                     React + Vite + TypeScript strict (owned by the frontend pair)
│   └── src/
│       ├── api/
│       │   ├── types.ts          request/response types + `ErrorCode` union, written BY HAND from the contract
│       │   └── client.ts         ~50-line typed fetch wrapper: X-XSRF-TOKEN, error envelope → {code, fields},
│       │                         401 → redirect to the right login page
│       ├── features/
│       │   ├── start/            `/` start page, 3-step mechanic, «Почати шопінг» (US-01.1, US-01.2)
│       │   ├── feed/             `/feed` swipe feed, "all viewed" state (US-08.1, US-08.2, US-09, US-10)
│       │   │   └── session.ts    buyer session store {viewedIds, favoriteIds}, one versioned localStorage key
│       │   ├── favorites/        `/favorites` «Вподобане» + brand-site button (US-16, US-19, US-32)
│       │   ├── buyer-auth/       `/register`, `/login`, logout, favourites merge (US-02, US-03)
│       │   ├── cabinet-auth/     `/brand/register`, `/brand/login`, logout (US-21, US-21.1)
│       │   ├── cabinet-profile/  `/brand/profile` name, logo, consent (US-22.1, US-22.2)
│       │   └── cabinet-products/ `/brand/products`, `/brand/products/:id` (`new` for create) — form,
│       │                         preview, publish/unpublish (US-25.1, US-25.2, US-26, US-31)
│       └── shared/
│           ├── ui/ProductCard    the ONE card renderer: feed, «Вподобане», brand preview (NFR-17)
│           ├── links.ts          withUtm() — the only builder of outbound links
│           ├── messages.uk.ts    Record<ErrorCode, string> — the only place for Ukrainian error texts
│           └── validation.ts     zod schemas mirroring Bean Validation
├── docs/                         requirements, analysis, ADRs, architecture (read-only for assistants)
│   └── contracts/api.md          the living API contract (created in week 1, see §5.2)
├── user stories/                 one file per MVP story (read-only for assistants)
├── prompts/                      prompt log of the assignment steps (append new files only)
└── .github/
    ├── workflows/                minimal CI (ADR-0011)
    └── pull_request_template.md  review checklist (ADR-0011, §7)
```

### 3.1. Responsibilities and boundaries

- **`backend/`** — the API and the authority on every rule. Each feature package contains `XController`, `XService`, `XRepository` and its request/response **records**. A package may use another feature **only through that feature's service** (never its repository or controller). Shared cross-cutting code goes to `common` only.
- **`frontend/`** — the SPA. Feature folders own their screens and hooks. Anything used by two or more features goes to `src/shared/`; all HTTP goes through `src/api/client.ts`. Features never call `fetch` directly.
- **`docs/contracts/api.md`** — the one-way source for `frontend/src/api/types.ts` and for backend controller shapes.
- **`scripts/`** — developer tooling only (no app logic).
- **Root `package.json`** — scripts only; no runtime dependencies.

---

## 4. Development commands and workflow

### 4.1. Prerequisites

JDK 21 (Temurin) and Node LTS (version in `.nvmrc`). Neither Maven Wrapper nor npm installs a JDK. **No Docker** anywhere. The first backend build downloads the embedded Postgres binaries (tens of MB).

### 4.2. Commands

These are fixed by ADR-0003/0004/0010/0011. Exact npm script names are created by the walking skeleton; if `package.json` differs from this table, `package.json` wins — update this file in the same PR.

| Task | Command |
|---|---|
| Install everything (root + `frontend` workspace) | `npm install` |
| Run the app locally (Spring `dev` profile on 8080: embedded Postgres + Flyway + seed; Vite on 5173 with `/api` proxy) | `npm run dev` |
| Fallback: backend alone (macOS/Linux; Windows: `mvnw.cmd`) | `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` |
| Fallback: frontend alone | `npm --workspace frontend run dev` |
| Phone demo on the same Wi-Fi | start Vite with `--host`, open `http://<laptop-ip>:5173` |
| Apply DB migrations | automatic: Flyway runs on backend startup and in every `@SpringBootTest` |
| Reset the local DB | stop the backend, delete `backend/.data/`, start again (migrations + seed re-run) |
| Backend build + all tests (what CI runs) | `cd backend && ./mvnw verify` |
| One backend test class | `cd backend && ./mvnw test -Dtest=ProductRepositoryTest` |
| Frontend lint (ESLint + Prettier) | `npm --workspace frontend run lint` |
| Frontend typecheck (`tsc --noEmit`, strict) | `npm --workspace frontend run typecheck` |
| Frontend unit tests (Vitest) | `npm --workspace frontend run test` |
| Operator password reset (`ops` profile) | `reset-password <brand\|buyer> <email>`, wrapped as a root npm script |

**Before declaring any task done**, run every check that touches the changed side: `./mvnw verify` for `backend/`; lint + typecheck + test for `frontend/`. Report failures with their output; never claim green without running.

### 4.3. Migrations

- One migration per schema change: `backend/src/main/resources/db/migration/V<yyyyMMdd>_<HHmm>__<snake_description>.sql` (e.g. `V20261103_1200__create_products.sql`). Timestamp versions avoid collisions between two developers (R-T08).
- **Never edit a migration that has been merged to `main`**; add a new one.
- The migration and the repository code that uses it go in the **same PR**, with a repository test on embedded Postgres (R-T16).
- No DB triggers, no stored procedures. Invariants the schema cannot express are enforced in service/repository SQL (data-model §4, T-1…T-14).

### 4.4. Workflow

- Small PRs: one story slice, ideally < 400 changed lines (R-M04). Name the story ID(s) in the PR title/description.
- Delivery order (R-M01): anonymous buyer flow → brand flow → buyer accounts. Feature freeze 8 Dec 2026.
- Contract first: a change to an endpoint goes **`docs/contracts/api.md` → controller + MockMvc test → `frontend/src/api/types.ts` → `messages.uk.ts`**, in one PR, reviewed by one backend and one frontend developer.
- The author must be able to explain every line; prefer plain, readable code over annotation "magic".

---

## 5. Code generation rules and contracts

### 5.1. Layer boundaries

```
Backend:  XController ──► XService ──► XRepository ──► Postgres (JdbcClient SQL)
                 (request/response records)     (returns Java records)
Frontend: page/component (features/*) ──► hooks (TanStack Query / Zustand store) ──► src/api/client.ts ──► /api
```

- **Controller:** HTTP only — routing, `@Valid` request records, reading the principal from the session, mapping to response records. No SQL, no business rules, no `JdbcClient`.
- **Service:** use-case logic and domain rules (state transitions, consent rules, email normalization, ownership). Transactions (`@Transactional`) live here. This **is** the domain layer in this architecture; do not create a separate `domain/` package, ports, adapters or DDD aggregates (ADR-0001 rejected hexagonal).
- **Repository:** SQL via `JdbcClient` and row mapping to records. Every brand query filters by the session's brand ID (INV-07, T-7). The SQL sits in the repository class.
- **No skipping layers:** controller → repository is forbidden; one feature's controller/service → another feature's repository is forbidden (go through that feature's service).
- The owner ID (brand or buyer) comes **from the session principal**, never from the request body or path.

### 5.2. API contract conformance

The contract today is `docs/architecture/api.md` (draft). Per ADR-0003/0005 the living contract is `docs/contracts/api.md`; overview Q-02 proposes moving the draft there in week 1. Until that move happens, treat `docs/architecture/api.md` as the contract and do not create a second copy on your own.

- **Routes:** implement only the endpoints listed in the contract (§2 of `api.md`), with the documented method, path, access level and status codes. Endpoints marked ✚ (`GET /api/brand/products/{id}`, `GET /api/session`) are part of the draft contract but are proposals — implement them as documented and do not add others.
- **Conventions:** base path `/api`; JSON UTF-8; IDs are UUID strings; timestamps ISO-8601 UTC; price is an integer of UAH (`priceUah`); enums in JSON are UPPER_CASE (`"DRAFT"`, `"PUBLISHED"`, `"INCOMPLETE" | "ACTIVE" | "CONSENTED"`, `"BRAND" | "BUYER"`); product URLs returned exactly as stored (UTM is added only by the frontend).
- **Error envelope** — every non-2xx response from `/api`, produced by the **single** `@RestControllerAdvice` in `ua.fulla.common`:

  ```json
  { "error": { "code": "CARD_INVALID_URL", "message": "developer-facing English", "fields": { "productUrl": "CARD_INVALID_URL" } } }
  ```

  - `code` is a value of the Java `ErrorCode` enum = the TS `ErrorCode` union = the dictionary in `api.md` §3.2. `fields` is optional (request field → code). One request → one top-level `code` (the first failing field in form order); `fields` lists all.
  - `message` is English and **never shown to users**. Ukrainian texts exist **only** in `frontend/src/shared/messages.uk.ts`, copied verbatim from the stories.
  - Login errors never reveal which field is wrong: always `401 INVALID_CREDENTIALS`.
- **Status codes** (`api.md` §1, §3): 400 validation (`VALIDATION_FAILED`, `EMAIL_TAKEN_OR_INVALID` format, `PASSWORD_TOO_SHORT`, `PROFILE_INVALID`, `IMAGE_INVALID`, `CARD_INVALID_NAME`, `CARD_INVALID_PRICE_OR_PHOTO`, `CARD_INVALID_URL`); 401 `UNAUTHENTICATED` / `INVALID_CREDENTIALS`; 403 `FORBIDDEN` (wrong account type or CSRF only); **404 `NOT_FOUND` for unknown IDs and for another brand's resources** (Q-04, not 403); 409 `EMAIL_TAKEN_OR_INVALID` (taken), `CONSENT_LOCKED`, `PROFILE_INCOMPLETE`, `CARD_NOT_EDITABLE`, `CONSENT_REQUIRED`, `PUBLISH_FIELDS_MISSING`, `INVALID_STATE`; 429 `TOO_MANY_REQUESTS`; 503 `SERVICE_UNAVAILABLE`.
- **Validation:** Bean Validation on request records is the authority (`@NotBlank`, `@Size`, strict email `name@domain.tld`, custom `@HttpUrl` = parses with `java.net.URI`, scheme `http`/`https`, non-empty host). The frontend zod schemas in `shared/validation.ts` repeat the same rules for instant feedback; both sides are tested with the **same list of valid/invalid examples** (R-T17).
- **Tests:** MockMvc tests assert the JSON field names of the contract examples, so the backend cannot silently diverge (ADR-0005).
- **Frontend side:** `types.ts` mirrors the contract by hand; `messages.uk.ts` is `Record<ErrorCode, string>`, so a code without a text fails `tsc`. The client keeps all entered form data on any 4xx and handles 401 by redirecting to `/login` or `/brand/login`.

### 5.3. Domain invariants and state machines (`docs/architecture/domain-model.md`)

Implement transitions **exactly** as the state machines define them; reject everything else with the documented code.

- **Brand profile** — state is **derived, not stored**: `name IS NULL` → `INCOMPLETE`; `consent_given_at IS NULL` → `ACTIVE`; else `CONSENTED`. Incomplete cannot create cards (`409 PROFILE_INCOMPLETE`); Active can create/edit drafts but not publish (`409 CONSENT_REQUIRED`); Consented can publish. Consent is one-way for the brand: `consentGiven: false` after it was given → `409 CONSENT_LOCKED` (INV-09). Consent is stored as timestamp + the **exact** text shown (A-17). Only the operator (`ops`) withdraws consent, unpublishing all the brand's cards in the same transaction (T-6).
- **Product card** — `DRAFT ⇄ PUBLISHED`, no deletion ever, no final state.
  - Publish = **one conditional `UPDATE`** (`… WHERE id=:id AND brand_id=:brand AND status='draft' AND EXISTS (consent)`); 0 rows → re-read to choose `NOT_FOUND` / `INVALID_STATE` / `CONSENT_REQUIRED` (T-1). Never check-then-update in Java.
  - Published cards are read-only: edit = `UPDATE … WHERE status='draft'`; on a Published card → `409 CARD_NOT_EDITABLE` (INV-10, T-3). Changing a price = unpublish → edit → publish.
  - Republish sets a new `published_at` (card moves to the end of the feed).
  - Card creation requires a saved brand name, in the same statement/transaction (T-2, INV-11).
  - `brandName` is **never stored** on the card; it is always joined from `brand_profiles` (INV-03).
- **Feed** — only Published cards (INV-01), ordered by `published_at, id`; the client shows the first card whose ID is in neither `viewedIds` nor `favoriteIds`. TanStack Query refetches on window focus and when fewer than 3 unviewed cards remain. A card unpublished while on screen stays actionable.
- **Card impression (browser only)** — the like/skip reducer in `features/feed/session.ts` is **keyed by card ID**, not by timers: an action on an ID already in `viewedIds` is ignored (US-10 S2, INV-05). Swipe and button call the **same** `like(id)` / `skip(id)` action (BR-11).
- **Favourites (registered buyers)** — append-only; `POST /api/me/favorites { productIds }` (≤ 500) is the **only** write: `INSERT … SELECT … WHERE p.id = ANY(:ids) ON CONFLICT DO NOTHING`, unknown IDs ignored, returns the full set (T-11). The same call serves the login/register merge, a single like and retries. The response **replaces** the local set only after success. Logout clears local favourites and progress.
- **Accounts** — email normalized (`strip().toLowerCase(Locale.ROOT)`) before every insert and lookup (T-10); uniqueness is enforced by the `UNIQUE` index, and `DuplicateKeyException` (SQLState 23505) → `409 EMAIL_TAKEN_OR_INVALID` — never a check-then-insert (NFR-04). Brand registration inserts account + empty profile in one transaction (T-9). Register = create + log in. Logging in as the other account type replaces the session.
- **Images** — type decided by magic bytes (PNG `89 50 4E 47`, JPEG `FF D8 FF`, WEBP `RIFF….WEBP`), never by extension or client `Content-Type`; ≤ 5 242 880 bytes; served with stored `Content-Type`, `X-Content-Type-Options: nosniff`, `Cache-Control: public, max-age=31536000, immutable`; images are immutable (replace = new ID). A card/profile may reference only its own brand's images (T-8). No SVG.
- **Outbound links** — built **only** by `withUtm()` in `shared/links.ts`: add `utm_source=fulla` (with `&` if a query exists), before any `#fragment`, unchanged if `utm_source` already exists; rendered as `<a target="_blank" rel="noopener noreferrer">`. The backend stores the brand URL unchanged.
- **UI** — one `ProductCard` for feed, «Вподобане» and preview (NFR-17); price displayed as `2400 грн` (no thousands separator); placeholder on image error without blocking actions (NFR-10); brand logo never on buyer cards.

Items marked **(proposal)** or Q-xx in the architecture docs are not agreed decisions. Implement them as documented, but mention them in the PR so a human can confirm.

### 5.4. Database schema conformance (`docs/architecture/data-model.md`)

- Tables: `brand_accounts`, `brand_profiles`, `products`, `images`, `buyer_accounts`, `favorites` — with exactly the columns, types, nullability, `CHECK`s, PKs, FKs and indexes listed there. No other tables (sessions are in memory; anonymous buyer state is in localStorage).
- Conventions: `snake_case`; `uuid` PKs with `gen_random_uuid()`; `created_at`/`updated_at` as `timestamptz` (UTC); price `integer` UAH; images `bytea` (never JPA `@Lob`/`oid`); `status` is `varchar` with `CHECK (status IN ('draft','published'))` (lowercase in DB, UPPER_CASE in JSON).
- No `DELETE` statements on business tables; no `ON DELETE` rules.
- Java mapping: repository methods return records whose fields correspond 1:1 to the documented columns (camelCase in Java, snake_case in SQL).

---

## 6. Strict prohibitions (MUST NOT)

1. **MUST NOT invent or alter entity fields, columns, enum values, status names or error codes** without first checking `docs/architecture/data-model.md`, `domain-model.md` and `api.md`. If something is genuinely missing, stop and ask; do not improvise a column or code.
2. **MUST NOT create undocumented API routes** or ad-hoc response/error shapes. Every non-2xx body is the single envelope from the one `@RestControllerAdvice`. No `ResponseEntity.badRequest().body("text")`, no Spring default error JSON, no Ukrainian text in API responses.
3. **MUST NOT implement Out-of-Scope stories** (§1.2) or add "hooks" for them (filters, sizes, composition, delete-favourite, import jobs, server-side fetching of brand URLs).
4. **MUST NOT hardcode secrets**, API keys, DB URLs, usernames or passwords. Use Spring properties with environment variables (`SPRING_DATASOURCE_URL/USERNAME/PASSWORD`, `SPRING_PROFILES_ACTIVE`) and commit only templates (e.g. `.env.example`) with placeholders. Never commit `.env`, `backend/.data/`, or real credentials. Dev seed accounts are clearly fake and exist only in the `dev` profile.
5. **MUST NOT add dependencies outside §2.3** (Maven, npm, CDN scripts, fonts from a CDN) without a human decision.
6. **MUST NOT edit `docs/**`, `user stories/**`, `README.md` or existing `prompts/*`** unless a human explicitly asks. The exception is the contract workflow in §4.4, which updates `docs/contracts/api.md` together with the controller.
7. **MUST NOT put registration, login or any form in front of the buyer feed** (BR-03, NFR-01, R-P11). Every buyer function works anonymously.
8. **MUST NOT bypass security:** no disabling CSRF, no `permitAll` on `/api/brand/**` (except register/login) or `/api/me/**`, no owner ID taken from the request, no plaintext or reversible passwords, no logging of passwords or session IDs.
9. **MUST NOT render brand content unsafely:** no `dangerouslySetInnerHTML`, no outbound link built outside `withUtm()`, no `javascript:`/`data:` URLs (only `http`/`https` product URLs; only `https://` image URLs).
10. **MUST NOT replace DB-level guarantees with UI guards or timers** (ADR-0009). Debounce/disabled buttons are UX only.
11. **MUST NOT use JPA, Docker, H2, Testcontainers** or any technology the ADRs rejected; MUST NOT add abstractions beyond `ImageStore`.
12. **MUST NOT use `any` in `src/shared` or `src/api`**; elsewhere only with a `// TODO(types)` comment and an explicit cast (ADR-0013).
13. **MUST NOT store anything about anonymous buyers on the server**, and nothing about registered buyers beyond email, password hash and liked product IDs (NFR-19).
14. **MUST NOT skip, disable or weaken tests** to make CI green.

---

## 7. PR checklist (ADR-0011)

- [ ] Story ID(s) named; change is one story slice.
- [ ] API changed? → `docs/contracts/api.md` and `frontend/src/api/types.ts` updated in this PR; MockMvc test asserts the JSON field names.
- [ ] New error code? → added to the Java `ErrorCode` enum, the contract dictionary, the TS `ErrorCode` union **and** `messages.uk.ts` (exact Ukrainian text from the story).
- [ ] Schema changed? → new timestamped Flyway migration + repository test on embedded Postgres.
- [ ] Validation rule changed? → Bean Validation and zod schema updated with the same examples in JUnit and Vitest.
- [ ] No new dependency outside §2.3.
- [ ] `./mvnw verify` and frontend lint + typecheck + test pass locally.

### Must-have tests (ADR-0011)

- Backend: registration race (two parallel inserts → one 409), publish gate (no consent → refused), favourites merge (overlap, double like, retry), `@HttpUrl` and email rules, CSRF/401 smoke test, role separation (buyer session on `/api/brand/**` → 403), JSON field names vs contract examples.
- Frontend: `withUtm`, like/skip reducer (US-10 S2), form schemas checked against the same examples as the Java validation tests.
