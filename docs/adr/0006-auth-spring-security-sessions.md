# ADR-0006: Authentication — Spring Security, BCrypt, in-memory server sessions, one cookie

## Status
Proposed — 2026-10-28 (revised: Java backend, one cookie; then simplified: in-memory sessions instead of Spring Session JDBC)

## Context
- **Buyers** can do everything without an account (NFR-01), but may register or log in so that «Вподобане» moves to the server (US-02, US-03, ADR-0012).
- **Brands** register (US-21) and log in/out (US-21.1). Neither side has password reset or email verification (A-01).
- Passwords must not be recoverable (NFR-03). A brand sees only its own data (INV-07); a buyer sees only their own favourites.
- The demo runs locally (ADR-0010). A server restart during development or demo is rare and cheap to recover from: the user logs in again.

## Options
1. **Spring Security + `BCryptPasswordEncoder` + default in-memory `HttpSession`, one cookie.**
   + No extra dependency or tables; the standard Spring Security setup with the most examples; logout invalidates the session.
   − Every server restart logs everyone out. If the optional Render deploy is used, the same happens whenever the instance sleeps.
2. **Same, with Spring Session JDBC (sessions in Postgres).**
   + Logins survive restarts and host sleep.
   − Extra dependency, session tables in a migration, one more thing to debug. Postponed.
3. **JWT (stateless).**
   + No server session.
   − Logout can't revoke a token; refresh handling; more for the FE.

## Decision
Option 1. **Re-login after a server restart is accepted.**
- Tables `brand_accounts` and `buyer_accounts` (each `email UNIQUE`, normalized, and `password_hash` with BCrypt).
- Login controllers (`/api/brand/login`, `/api/buyer/login`) authenticate against their own table and store a principal with `accountType` and `accountId`, with authority `ROLE_BRAND` or `ROLE_BUYER`. Register = create + log in; brand → profile (US-21 CL), buyer → favourites merge (ADR-0012).
- **One session cookie** (`server.servlet.session.cookie.name=FULLA_SESSION`): `HttpOnly`, `SameSite=Lax`, session timeout 30 days. Logging in as the other account type in the same browser **replaces** the current login. Accepted: brand and buyer are demoed in different browsers.
- In the `dev` profile, `server.servlet.session.persistent=true` keeps sessions across normal restarts on a developer laptop. Optional convenience: it does not survive a crash.
- Authorization: `/api/brand/**` (except register/login) requires `ROLE_BRAND`; `/api/me/**` requires `ROLE_BUYER`; everything else under `/api` is public. Every repository query filters by the owning account ID (INV-07).
- CSRF stays on: a cookie token repository (`XSRF-TOKEN` cookie, `X-XSRF-TOKEN` header added by the frontend API client, ADR-0008).
- Login error: `INVALID_CREDENTIALS`, the same for unknown email and wrong password. Simple in-memory rate limit on login/register (e.g. 10/min per IP).
- Password reset is an operator command run with the `ops` Spring profile (`reset-password <brand|buyer> <email>`), wrapped as a root npm script.

## Consequences
- **Simpler:** no session tables and no Spring Session; the security config is the textbook one.
- **Harder:** a restart ends all sessions; the frontend must handle `401` by sending the user to the right login page and keeping the anonymous favourites in the browser. Spring Security + CSRF must still be configured once, early, with tests (R-T09). Brand and buyer can't be logged in at the same time in one browser.
- **Postponed:** Spring Session JDBC (to add if the app is deployed and re-login after sleep becomes a problem: one dependency + one migration, no other code change), password reset by email, email verification, 2FA, social login.

## Related stories
US-21, US-21.1, US-22.1, US-22.2, US-25.1, US-31 (cabinet access); US-02, US-03 (buyer accounts); US-01.1, US-01.2, US-09 (anonymous use stays possible).
