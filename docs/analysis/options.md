# FULLA — Technical Options (MVP)

**Purpose:** rate the options for every technical decision against **our** constraints, not against general best practice. Each decision is fixed in an ADR (`docs/adr/`).
**Inputs:** [`requirements-digest.md`](requirements-digest.md) (assumptions A-01…A-20, revised 28.10.2026), [`../requirements.md`](../requirements.md), MVP stories in [`user stories/`](../../user%20stories/UserStoriesREADME.md).
**Revision 28.10.2026:** the backend language changed from Node.js to **Java**. The team's preferred stack (Java 21, Spring Boot 3, Maven Wrapper, Spring Data JPA + Flyway, Neon + embedded Postgres, Spring Security + BCrypt + JDBC sessions, springdoc-openapi + openapi-typescript, JUnit 5 + MockMvc, Render Dockerfile + Neon, GitHub Actions) is rated below against alternatives, not accepted as given. Where the rating disagrees (data access, D3b), the reason is stated.

## Constraints used for rating

| Key | Constraint |
|---|---|
| **Sk** | Skills: 2 backend devs with **basic Java** (university courses); 2 frontend devs with **basic JS/React**; 1 designer, 1 lead. |
| **Dl** | Deadline: 15 Dec 2026, about **7 weeks** from 28 Oct 2026. |
| **St** | Stack: **Java** backend, **React** frontend (TypeScript or JavaScript, see D7a). |
| **€0** | Budget: 0 UAH, **no bank card** for any service. A public URL is nice-to-have; local is the baseline. |
| **Lo** | Local start as simple as possible after `git clone`; **no Docker** on every laptop. Each laptop must have JDK 21 and Node installed. Neither Maven Wrapper nor Gradle installs a JDK. |
| **CC** | Claude Code writes most of the code: well-known libraries, one obvious place for each thing, and code that a basic-level reviewer can still read. |

Rating: **+** fits · **0** workable, with a cost · **−** conflicts with the constraint.
Free-tier conditions (limits, "no card") are as known on 28 Oct 2026. Re-check them at sign-up (R-T01 in `risks.md`).

Decisions are listed in dependency order: D0 → D1 → D2 → D3 → D4 → D5 / D6 / D7 / D7a → D8 → D9; D10 applies to all.

---

## D0. Application architecture style

### D0a. Overall split

The backend is Java and the UI is React, so a JS full-stack framework (Next.js) is no longer an option.

| Option | Sk | Dl | St | €0 | Lo | CC | Notes |
|---|---|---|---|---|---|---|---|
| **React SPA built into the Spring Boot app (one origin, one deployable)** | + | + | + | + | + | + | Each pair owns one folder; the contract is explicit (OpenAPI). Cookies work without CORS. |
| SPA and API deployed separately (static host + API host) | + | 0 | + | + | + | 0 | Cross-origin cookies (`SameSite=None`, CORS, Safari third-party cookie blocking). |
| Server-side templates (Thymeleaf) + React only for the swipe | 0 | − | + | + | + | 0 | Two UI technologies; FE devs would write Thymeleaf; the preview must match the feed card (NFR-17). |

- **Tipping criterion:** team shape (2 Java + 2 React) plus cookie auth. One origin keeps auth simple, and each pair stays inside its own folder.
- **Would change if:** the frontend had to be hosted separately (e.g. a CDN requirement). Then CORS and cross-site cookies, or token auth, would be needed.

### D0b. Backend style

| Option | Sk | Dl | St | €0 | Lo | CC | Notes |
|---|---|---|---|---|---|---|---|
| Global layers (`controller/`, `service/`, `repository/` packages) | + | + | + | + | + | 0 | The classic course layout, but one story touches 3 distant packages. |
| **Package-by-feature, layered inside** (`ua.fulla.products` → `ProductController`, `ProductService`, `ProductRepository`) | + | + | + | + | + | + | Spring's recommended style; a story maps to one package; package-private classes hide internals. |
| Clean / hexagonal | − | − | + | + | + | 0 | Ports and adapters for ~7 tables is boilerplate; only one real adapter is needed (`ImageStore`, D6). |
| Microservices | − | − | + | − | − | − | Several free JVM services, each sleeping and each 512 MB. Nothing in scope needs it. |

- **Tipping criterion:** one package per feature area makes ownership and Claude Code prompts predictable without architectural ceremony.
- **Would change if:** we needed swappable infrastructure everywhere (hexagonal) or independent scaling (services). Neither applies.

### D0c. Frontend style

| Option | Sk | Dl | St | €0 | Lo | CC | Notes |
|---|---|---|---|---|---|---|---|
| By type (`components/`, `pages/`, `hooks/`) | + | + | + | + | + | 0 | Fine for 5 screens, but turns into a mess by week 5. |
| **Feature folders + `shared/`** (`features/feed`, `features/favorites`, `features/cabinet`, …) | + | + | + | + | + | + | Same mental model as package-by-feature on the backend. |
| Feature-Sliced Design | − | − | + | + | + | 0 | Strict layers and import rules are too much to learn in 7 weeks. |

- **Tipping criterion:** the same "feature = folder" model on both sides.

---

## D1. Platform: web or mobile

Unchanged by the language switch.

| Option | Sk | Dl | St | €0 | Lo | CC | Notes |
|---|---|---|---|---|---|---|---|
| **Responsive web, mobile-first** (one React app: buyer + cabinet) | + | + | + | + | + | + | Matches the requirements literally: a shared link, root address (US-01.1), "browser session" (US-09), "new tab" (US-19, US-26), 320 px+ (NFR-08). |
| Web + PWA (installable, offline cache) | + | 0 | + | + | + | 0 | A service worker cache can show stale feed data, which conflicts with "immediately available" (NFR-07, US-31). |
| React Native (Expo) buyer app + web cabinet | − | − | + | 0 | 0 | 0 | Two UI stacks for 2 FE devs; the buyer would need to install an app; the preview can't share the feed renderer (NFR-17). |
| Expo + react-native-web for both | − | − | + | + | 0 | 0 | Cabinet forms and uploads are awkward with RN primitives. |

- **Tipping criterion:** the buyer arrives through a link in a mobile browser, and the preview must render with the same component as the feed (NFR-17).
- **Would change if:** push notifications, an app-store presence or offline swiping became requirements.

---

## D2. Repository structure

| Option | Sk | Dl | St | €0 | Lo | CC | Notes |
|---|---|---|---|---|---|---|---|
| **One repo: `backend/` (Maven Wrapper) + `frontend/` (Vite) + `contract/openapi.json` + root `package.json` with scripts only** | + | + | + | + | + | + | Each pair works in its own folder with its own tool. Root `npm install` + `npm run dev` starts both. |
| Maven multi-module, `frontend-maven-plugin` builds the React app | 0 | 0 | + | + | + | 0 | One build tool, but FE devs run Maven for every change and Maven downloads its own Node. Slower FE dev loop. |
| Two repositories (frontend, backend) | 0 | − | + | + | − | − | The contract is copied between repos; two clones; Claude Code sees half the system. |

- **Tipping criterion:** each pair uses its native tool (Maven, npm) day to day, with one clone and one start command.
- **Would change if:** the team wanted a single `./mvnw package` to produce everything locally. The Dockerfile (D9) already does that for deploys.

---

## D3. Data store and data access

### D3a. Store (local and deployed)

| Option | Sk | Dl | St | €0 | Lo | CC | Notes |
|---|---|---|---|---|---|---|---|
| **Neon Postgres when deployed + embedded Postgres locally (zonky `embedded-postgres`, started by the `dev` profile)** | + | + | + | + | + | + | Real Postgres binaries are downloaded as a Maven dependency, with no Docker. Same dialect everywhere; same Postgres major as Neon. |
| H2 in PostgreSQL mode locally + Neon | + | + | + | + | + | − | Dialect gaps (e.g. `ON CONFLICT`, `bytea`, `timestamptz` behaviour): ADR-0009's SQL would work only in production. |
| Postgres installed natively on each laptop | 0 | 0 | + | + | 0 | + | A manual installer and Windows service on 6 machines; version drift. |
| Postgres in Docker | + | + | + | + | − | + | Not every laptop has Docker. |
| One shared Neon DB (or a branch per dev) for local work | + | 0 | + | 0 | 0 | 0 | Needs internet; free compute hours shared by six people. |

### D3b. Data access

The three operations that carry our invariants are plain SQL: the conditional publish `UPDATE … WHERE … AND EXISTS(consent)`, `INSERT … ON CONFLICT DO NOTHING` for the favourites merge, and `bytea` image storage (ADR-0009, ADR-0007, ADR-0012).

| Option | Sk | Dl | St | €0 | Lo | CC | Notes |
|---|---|---|---|---|---|---|---|
| Spring Data **JPA** (team preference) | 0 | 0 | + | + | + | 0 | Fast CRUD, most tutorials. But all 3 critical operations need native `@Modifying @Query`. Pitfalls a basic team hits quickly: `@Lob byte[]` maps to Postgres `oid`, not `bytea`; lazy loading and N+1; open-session-in-view; dirty checking writes at unexpected times. |
| Spring Data **JDBC** | 0 | + | + | + | + | 0 | Repositories without lazy loading or dirty checking; custom SQL via `@Query`. The aggregate rules confuse beginners, and there are fewer examples. |
| **Spring `JdbcClient` (+ `RowMapper`/records), schema owned by Flyway** | + | + | + | + | + | + | Plain SQL, the same thing taught in university JDBC courses. Each critical operation is one visible statement; `byte[]` ↔ `bytea` works directly. More boilerplate, which Claude Code writes and humans can still read. |
| jOOQ | − | − | + | + | 0 | 0 | Type-safe SQL, but code generation needs a running DB in the build. |

| Migrations | Notes |
|---|---|
| **Flyway, plain SQL files** | One SQL dialect to learn; works with all options above. |
| Liquibase | XML/YAML changelogs, more to learn. |

- **Tipping criterion (store):** no Docker and the same dialect as production. That leaves embedded Postgres + Neon.
- **Tipping criterion (access):** our invariants live in SQL. With JPA we would write those statements as native queries anyway, and add ORM pitfalls on top. **The rating leans to `JdbcClient` and away from the team's JPA preference.**
- **Would change if:** the model grew to many related entities with rich object graphs (then JPA pays off), or a dev on the team already knew JPA well.

---

## D4. Backend: framework, validation, error format, API contract

| Option | Sk | Dl | St | €0 | Lo | CC | Notes |
|---|---|---|---|---|---|---|---|
| **Spring Boot 3 (Java 21 LTS)** | + | + | + | + | + | + | Taught in many courses; huge ecosystem; Claude Code knows it best. Check the OSS support status of the latest 3.x at setup. If 3.x is out of support, Boot 4 changes nothing in these ADRs. |
| Javalin | + | 0 | + | + | + | 0 | Tiny and explicit, but security, validation, sessions and OpenAPI are all hand-assembled. |
| Micronaut / Quarkus | 0 | 0 | + | + | + | 0 | Fast startup and low memory (good for Render's 512 MB), but less familiar, with fewer examples. |

| Validation | Sk | Dl | CC | Notes |
|---|---|---|---|---|
| **Jakarta Bean Validation (`@NotBlank`, `@Size`, `@Email`, custom `@HttpUrl`) on request records** | + | + | + | Standard in Spring. Constraints also appear in the OpenAPI schema (length, pattern). |
| Manual checks in services | + | 0 | − | Inconsistent, easy to forget. |

Rules are now written twice: Bean Validation in the backend, form schema in the frontend (D7). The backend is the authority; drift is caught by tests (R-T17).

| Error format | Sk | Dl | CC | Notes |
|---|---|---|---|---|
| **Own envelope `{ error: { code, message, fields? } }` via `@RestControllerAdvice`** | + | + | + | Kept from the original design (language-independent API contract). `code` is an enum exported in OpenAPI. `message` is developer-facing English; **Ukrainian UI texts live in the frontend, keyed by `code`.** |
| Spring `ProblemDetail` (RFC 9457) | + | + | + | Built into Spring 6, but we would still add `code`/`fields` as extensions, and the frontend already expects the envelope. |

| FE contract | Sk | Dl | CC | Notes |
|---|---|---|---|---|
| **springdoc-openapi → committed `contract/openapi.json` → `openapi-typescript` types + `openapi-fetch` client** | 0 | + | + | Types only, no generated runtime code. FE can work from the committed file without running the backend. CI regenerates and fails on diff. |
| openapi-generator full TS client | 0 | 0 | 0 | Large generated code base; harder to read. |
| Hand-written TS types | + | 0 | − | Drift guaranteed. |

API style stays **REST/JSON**; endpoints and error codes are unchanged (ADR-0005).

- **Tipping criterion:** the most familiar Java framework, and a contract the FE gets as generated types.
- **Would change if:** Render memory or cold start became the blocker (then Micronaut/Quarkus), or the frontend moved to JS (then generated types lose most of their value, D7a).

---

## D5. Authentication

Buyers: everything works **without an account** (NFR-01); optional registration moves «Вподобане» to the server (D5b, US-02, US-03). Brands: registration (US-21) + login/logout (US-21.1). No password reset or email verification (A-01).

| Option | Sk | Dl | €0 | Lo | CC | Notes |
|---|---|---|---|---|---|---|
| **Spring Security + `BCryptPasswordEncoder` + Spring Session JDBC (sessions in Postgres), one session cookie** | 0 | + | + | + | + | The standard Spring way; sessions survive Render restarts and sleep; logout invalidates the row. Configuring JSON login, two account types and CSRF for an SPA is the hardest part of the backend. |
| Spring Security with in-memory `HttpSession` | 0 | + | + | + | + | **Every login is lost when the free Render instance sleeps (~15 min idle) or redeploys.** |
| Own servlet filter + sessions table | 0 | 0 | + | + | 0 | Fewer concepts, but re-implements what Spring Security already does correctly (session fixation, CSRF). |
| JWT (stateless) | 0 | 0 | + | + | 0 | Logout can't revoke; refresh-token handling; more for the FE to manage. |

| CSRF for the SPA | Notes |
|---|---|
| **CSRF on, cookie token repository (`XSRF-TOKEN` cookie → `X-XSRF-TOKEN` header added by an `openapi-fetch` middleware)** | Spring's default protection kept; one small FE middleware. |
| CSRF off, relying on `SameSite=Lax` + same origin + JSON-only endpoints | Simpler, but turns off a default that Claude Code-generated code would otherwise rely on. |

- **Tipping criterion:** sessions must survive the free host sleeping, and logout must really end the session.
- **Would change if:** password reset or email verification became required (adds an email provider), or the API had to serve a separate mobile client (then tokens).

### D5b. Buyer accounts: what moves to the server, and how

Language-independent; unchanged.

| Option | Sk | Dl | €0 | Lo | CC | Notes |
|---|---|---|---|---|---|---|
| **Only favourites move; merged by product ID (set union); viewed progress stays in the browser** | + | + | + | + | + | Favourites are append-only (US-17 Out of Scope), so the merge has no conflicts. One idempotent endpoint handles merge, like and retry. |
| Favourites + all viewed progress on the server | 0 | − | 0 | + | 0 | A write per swipe to a sleeping free host. |
| Anonymous server ID from the first visit; account claims it | 0 | 0 | + | + | 0 | Stores data for visitors who never register (against NFR-19). |

| Account model | Notes |
|---|---|
| **Separate `brand_accounts` and `buyer_accounts`; the session records the account type (`ROLE_BRAND` / `ROLE_BUYER`); one cookie** | One email can be both. Logging in as the other type in the same browser replaces the first login (accepted: demo brand and buyer in different browsers). |
| One `accounts` table with a `role` | Every query must check the role; "one email, two roles" needs extra design. |

- **Tipping criterion:** append-only favourites turn the merge into a union, so the cheapest option is also correct.
- **Would change if:** removing favourites (US-17) entered scope (then tombstones are needed).

---

## D6. Uploaded images (logo US-22.1, product photo US-25.1)

Both stories allow **"upload or URL"** (`https://` image URLs; PNG/JPG/WEBP ≤ 5 MB).

| Option | Sk | Dl | €0 | Lo | CC | Notes |
|---|---|---|---|---|---|---|
| URL only, no uploads | + | + | + | + | + | Contradicts US-22.1 / US-25.1. |
| **Bytes in Postgres (`bytea`) behind an `ImageStore` interface** | + | + | + | + | + | One code path locally and deployed; no account. With `JdbcClient`, `byte[]` maps to `bytea` directly. Limited by Neon's free quota (0.5 GB). |
| Local disk | + | + | + | + | + | Free hosts have temporary disks: files vanish on restart/redeploy. |
| Cloudinary free (no card) | 0 | 0 | + | − | 0 | CDN and resizing, but keys and internet for every dev. |

- **Tipping criterion:** identical behaviour locally and deployed with zero extra accounts; demo scale (A-20) fits the quota after client-side resize.
- **Would change if:** the catalog grew past ~1,000 photos. Then a Cloudinary implementation replaces the DB one behind the same interface.

---

## D7. Frontend

| Concern | Options (rating Sk/Dl/CC) | Leans to |
|---|---|---|
| Build | **Vite** (+/+/+) · Create React App (deprecated, −) | Vite |
| Routing | **React Router** (+/+/+) · TanStack Router (0/0/+) | React Router |
| Server data | **TanStack Query + `openapi-fetch`** (0/+/+: cache, refetch on focus that D8 relies on, typed calls) · SWR (0/+/0) · `fetch` + `useEffect` (+/−/−) | TanStack Query + openapi-fetch |
| API types | **generated from `contract/openapi.json`** (D4) · hand-written (−) | generated |
| Error texts | **`frontend/src/shared/messages.uk.ts`: `Record<ErrorCode, string>`**, so a new backend code without a Ukrainian text fails the typecheck · texts sent by the backend (moves UI copy into Java) | frontend map |
| Styles | **CSS Modules + CSS variables for design tokens** (+/+/+) · Tailwind (0/+/+) · Mantine/MUI (0/+/0) | CSS Modules |
| Swipe gestures | **`motion` drag** (+/+/+) · `@use-gesture` + `react-spring` (0/0/0) · `react-tinder-card` (+/+/0) · pointer events by hand (−/−/0) | `motion` |
| «Вподобане» + progress (US-09, US-16, A-09) | **localStorage** for everyone, synced to the account for registered buyers (D5b) · IndexedDB (0/0/0) · sessionStorage (fails A-09: per tab) | localStorage |
| Buyer state container | **Zustand + `persist`** (+/+/+) · Context + `useReducer` (+/0/0) · Redux Toolkit (0/0/+) | Zustand |
| Cabinet forms | **react-hook-form + zod schemas (frontend only, mirroring the Bean Validation rules)** (0/+/+) · react-hook-form built-in rules (+/+/0) | react-hook-form + zod |
| Outbound links | **`withUtm()` in `frontend/src/shared/links.ts`**, unit-tested (UTM is applied where the link is rendered; the backend stores the brand's URL as entered) | frontend |

- **Tipping criterion:** the fewest new concepts that still cover the hard parts (swipe, persistence, refetch, typed API).

### D7a. Frontend language: TypeScript or JavaScript

| Option | Sk | Dl | St | CC | Notes |
|---|---|---|---|---|---|
| **TypeScript, `strict`** | 0 | + | + | + | The generated API types and `Record<ErrorCode, string>` only help in TS. `tsc` in CI catches the wrong field names and nulls that Claude Code produces. FE devs mostly read and adjust code, and reading TS is easier than writing it from scratch. |
| TypeScript, non-strict | + | + | + | 0 | Fewer red squiggles for beginners; misses `null`/`undefined` bugs, which are the most common ones. |
| JavaScript + JSDoc `// @ts-check` | 0 | 0 | + | 0 | Type checking with JS syntax; JSDoc types are verbose and less familiar than TS. |
| Plain JavaScript | + | 0 | + | − | Nothing to learn, but contract changes surface only at runtime; generated types are useless. |

- **Tipping criterion:** Claude Code writes most of the code. A compiler that rejects inconsistent code is cheaper than reviewers finding it.
- **Would change if:** after week 1 the FE devs can't work with strict TS. Then relax to non-strict, but keep TS so the generated types still work.

---

## D8. Consistency and concurrency

The rules are language-independent and unchanged (ADR-0009). Only the "how" column for the backend changed.

| Problem | Options | Leans to |
|---|---|---|
| **Unique email on simultaneous registration** (US-21, US-02, NFR-04) | (a) check-then-insert: − · (b) **`UNIQUE` index on normalized email; Spring's `DuplicateKeyException` (SQLState `23505`) → `EMAIL_TAKEN_OR_INVALID`**: + · (c) lock in a transaction: 0 | (b) |
| **No duplicates in «Вподобане» on double click** (US-09, US-10 S2) | (a) 200 ms debounce: 0 · (b) **reducer keyed by card ID + input lock**: + · (c) **`PRIMARY KEY (buyer_id, product_id)`** for registered buyers: + | (b) for everyone + (c) for registered buyers |
| **Merging browser favourites on register/login** | (a) server replaces local: − · (b) local replaces server: − · (c) **union, `INSERT … ON CONFLICT DO NOTHING`, response replaces the local set**: + | (c) |
| **Like while logged in; request fails** | (a) roll back: − · (b) **keep locally, re-send the set on next sync**: + | (b) |
| **Brand publishes mid-session** (US-31, A-10) | (a) snapshot: − · (b) **ordered feed by `published_at, id`, refetch on focus / low queue**: + · (c) SSE/WebSocket: − | (b) |
| **Brand unpublishes mid-session** (A-11) | **card on screen stays actionable; «Вподобане» fetched by IDs with an `available` flag** | as stated |
| **Publish gate** (BR-48) | (a) client only: − · (b) **one conditional `UPDATE`, executed with `JdbcClient`; 0 rows → error**: + | (b) |
| **Draft edited in two tabs** | (a) **last write wins**: + · (b) `version` column: 0 | (a), accepted risk |
| **Product link check** (US-26) | (a) **format only: `@HttpUrl` Bean Validation on the API + the same rule in the FE form schema; open in a new tab with `noopener,noreferrer`**: + · (b) server `HEAD` request: − (SSRF) | (a) |

- **Tipping criterion:** let the database or a pure function enforce each invariant, so it holds no matter what the UI does.

---

## D9. Deployment and hosting

### Local (mandatory)

| Option | Sk | Lo | CC | Notes |
|---|---|---|---|---|
| **Prerequisites JDK 21 + Node LTS; then `npm install && npm run dev`.** A Node script (`scripts/dev.mjs`) checks `java -version`, runs `mvnw` or `mvnw.cmd` with the `dev` profile (embedded Postgres + Flyway + demo seed) and Vite; Vite proxies `/api` to Spring. | + | + | + | No Docker. Works on Windows because the script picks the wrapper per OS. |
| Docker Compose | 0 | − | + | Not on every laptop. |
| Separate terminals (`./mvnw spring-boot:run`, `npm run dev` in `frontend/`) | + | 0 | + | Works, but two commands; kept as the documented fallback. |

### Public (nice-to-have)

| Option | Sk | Dl | €0 | CC | Notes |
|---|---|---|---|---|---|
| **Render free web service, built from a multi-stage Dockerfile on Render (Node stage builds React → Maven stage packages the JAR with the build in `static/` → JRE runtime) + Neon** | 0 | + | + | + | No local Docker needed: Render builds it. One origin. **512 MB RAM:** needs JVM memory flags. Cold start after ~15 min idle: ~1–2 min (instance wake + Spring startup). |
| Vercel / Netlify | − | − | + | 0 | No Java runtime for the API; the frontend alone would be cross-origin. |
| Static frontend host + API on Render | 0 | 0 | + | 0 | Cross-origin cookies and CSRF. |
| Tunnel from the demo laptop (`cloudflared` quick tunnel, no account) | + | + | + | + | Zero deploy work; public only while the laptop runs. Fallback. |

- **Tipping criterion:** same origin for cookie auth, one deployable artifact, and a no-card JVM host. Render is the only no-card free option we know of that runs a Docker-built JVM service.
- **Would change if:** Render required a card or the JVM didn't fit in 512 MB. Then use the tunnel for demos, or Micronaut/Quarkus for a smaller footprint (D4).

---

## D10. Quality and tooling

| Concern | Options | Leans to |
|---|---|---|
| Backend tests | **JUnit 5 + Spring Boot Test + MockMvc against embedded Postgres** (zonky `embedded-database-spring-test`, no Docker) · Testcontainers (needs Docker, −) · H2 in tests (dialect gaps, −) | JUnit 5 + MockMvc + embedded Postgres |
| Frontend tests | **Vitest** (shares Vite config; `withUtm`, reducer, form schemas) · Jest (ESM friction) · Playwright E2E (postpone; 1 smoke test if time allows) | Vitest |
| Formatting / lint | **Backend: Spotless (google-java-format or palantir) checked in CI. Frontend: ESLint + Prettier** · Checkstyle (more rules to argue about) | Spotless + ESLint/Prettier |
| Types | **`tsc --noEmit` strict** (D7a) | strict |
| CI | **GitHub Actions: `setup-java` (21, Maven cache) + `setup-node`; `./mvnw verify`; frontend lint/typecheck/test; contract drift check (regenerate `openapi.json` and TS types, `git diff --exit-code`)** · none | GitHub Actions |
| FE/BE contract | **OpenAPI from springdoc, committed** (D4) · none | OpenAPI |

- **Tipping criterion:** catch contract drift and inconsistent generated code automatically, on every PR, without Docker.

---

## Summary

| # | Decision | Leans toward | Main criterion | ADR |
|---|---|---|---|---|
| D0 | Architecture style | React SPA served by Spring Boot (one origin); backend package-by-feature; frontend feature folders | Team shape 2 Java + 2 React; cookie auth | [0001](../adr/0001-architecture-style.md) |
| D1 | Platform | Responsive mobile-first web, one React app | Buyer arrives via a link; preview = feed renderer | [0002](../adr/0002-platform-responsive-web.md) |
| D2 | Repository | One repo: `backend/` (Maven Wrapper) + `frontend/` (Vite) + `contract/` + root scripts | Each pair uses its own tool; one start command | [0003](../adr/0003-repository-structure.md) |
| D3 | Data store + access | Neon + embedded Postgres locally; Flyway; **`JdbcClient` (not JPA)** | No Docker, same dialect; invariants live in SQL | [0004](../adr/0004-postgres-embedded-neon-jdbcclient.md) |
| D4 | Backend | Spring Boot 3, Java 21, Bean Validation, error envelope, springdoc → openapi-typescript | Familiar framework; generated FE contract | [0005](../adr/0005-backend-spring-boot-rest-openapi.md) |
| D5 | Auth | Spring Security + BCrypt + Spring Session JDBC, one cookie, CSRF cookie token | Sessions survive host sleep; real logout | [0006](../adr/0006-auth-spring-security-jdbc-sessions.md) |
| D5b | Buyer accounts | Only favourites move to the server; union merge by product ID | Append-only favourites make union correct | [0012](../adr/0012-buyer-accounts-favorites-sync.md) |
| D6 | Images | Bytes in Postgres (`bytea`) behind `ImageStore`; URLs stored as-is | Same behaviour everywhere, no account | [0007](../adr/0007-image-storage-in-db.md) |
| D7 | Frontend | Vite, React Router, TanStack Query + openapi-fetch, CSS Modules, `motion`, Zustand + localStorage, react-hook-form + zod, UI texts keyed by error code | Fewest new concepts that cover the hard parts | [0008](../adr/0008-frontend-stack.md) |
| D7a | Frontend language | TypeScript, strict | Compiler catches generated-code mistakes; typed contract | [0013](../adr/0013-frontend-language-typescript.md) |
| D8 | Consistency | DB unique index; ID-keyed idempotent actions; union merge; refetching ordered feed; conditional publish update; format-only links | Invariants enforced by the DB or pure functions | [0009](../adr/0009-consistency-and-concurrency.md) |
| D9 | Deployment | Local: JDK 21 + Node, `npm install && npm run dev`; optional Render (Dockerfile built on Render) + Neon; tunnel fallback | Same origin; no-card JVM host | [0010](../adr/0010-deployment-and-hosting.md) |
| D10 | Quality & tooling | JUnit 5 + MockMvc + embedded Postgres, Vitest, Spotless, ESLint/Prettier, GitHub Actions with contract drift check | Automated checks without Docker | [0011](../adr/0011-quality-and-tooling.md) |
