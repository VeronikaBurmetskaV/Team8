# ADR-0006: Authentication — Spring Security, BCrypt, Spring Session JDBC, one session cookie

## Status
Proposed — 2026-10-28 (revised the same day: backend language changed to Java; one cookie instead of two)

## Context
- **Buyers** can do everything without an account (NFR-01), but may register or log in so that «Вподобане» moves to the server (US-02, US-03, ADR-0012).
- **Brands** register (US-21) and log in/out (US-21.1). Neither side has password reset or email verification (A-01).
- Passwords must not be recoverable (NFR-03). A brand sees only its own data (INV-07); a buyer sees only their own favourites.
- The free host sleeps after ~15 min idle and restarts on every deploy (ADR-0010), so in-memory sessions would log everyone out.

## Options
1. **Spring Security + `BCryptPasswordEncoder` + Spring Session JDBC (sessions in Postgres), one cookie.**
   + Standard, well documented, handles session fixation and CSRF; sessions survive sleep and redeploys; logout deletes the session row.
   − The hardest configuration in the backend: JSON login endpoints (no form login), two account types, CSRF for an SPA.
2. **Spring Security with in-memory sessions.**
   + Less config.
   − All logins lost whenever Render sleeps or redeploys.
3. **JWT (stateless).**
   + No session table.
   − Logout can't revoke a token; refresh handling; more for the FE.

## Decision
Option 1.
- Tables `brand_accounts` and `buyer_accounts` (each `email UNIQUE`, normalized, and `password_hash` with BCrypt). Spring Session tables are created by a Flyway migration.
- Login controllers (`/api/brand/login`, `/api/buyer/login`) authenticate against their own table and store a principal with `accountType` and `accountId`, with authority `ROLE_BRAND` or `ROLE_BUYER`. Register = create + log in; brand → profile (US-21 CL), buyer → favourites merge (ADR-0012).
- **One session cookie** `FULLA_SESSION`: `HttpOnly`, `SameSite=Lax`, `Secure` when deployed, 30 days. Logging in as the other account type in the same browser **replaces** the current login. Accepted: brand and buyer are demoed in different browsers.
- Authorization: `/api/brand/**` (except register/login) requires `ROLE_BRAND`; `/api/me/**` requires `ROLE_BUYER`; everything else under `/api` is public. Every repository query filters by the owning account ID (INV-07).
- CSRF stays on: a cookie token repository (`XSRF-TOKEN` cookie, `X-XSRF-TOKEN` header added by an `openapi-fetch` middleware).
- Login error: `INVALID_CREDENTIALS`, the same for unknown email and wrong password. Simple in-memory rate limit on login/register (e.g. 10/min per IP).
- Behind Render's proxy: `server.forward-headers-strategy=framework` so `Secure` cookies and redirects work.
- Password reset is an operator command run with the `ops` Spring profile (`reset-password <brand|buyer> <email>`), wrapped as a root npm script.

## Consequences
- **Simpler:** one cookie, one session store, logout that really ends the session; anonymous buyers still need nothing.
- **Harder:** Spring Security configuration must be done once, early, with tests (403 from CSRF and 401 loops are the typical failures, R-T09). Brand and buyer can't be logged in at the same time in one browser.
- **Postponed:** password reset by email, email verification, 2FA, social login, session listing.

## Related stories
US-21, US-21.1, US-22.1, US-22.2, US-25.1, US-31 (cabinet access); US-02, US-03 (buyer accounts); US-01.1, US-01.2, US-09 (anonymous use stays possible).
