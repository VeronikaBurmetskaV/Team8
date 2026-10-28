# ADR-0010: Deployment and hosting

## Status
Proposed — 2026-10-28 (revised the same day: backend language changed to Java)

## Context
Local is the mandatory demo; a public URL is nice-to-have. Local start must be as simple as possible after `git clone`, without Docker. No bank card. Cookie auth (ADR-0006) is simplest on one origin. The backend is a Spring Boot JAR (ADR-0005); free hosts give ~512 MB RAM and sleep when idle.

## Options
1. **Render free web service built from a multi-stage Dockerfile on Render; Spring Boot serves the React build; DB on Neon.**
   + One origin; no local Docker needed (Render builds the image); the same JAR runs locally and deployed.
   − 512 MB RAM for a JVM; cold start ~1–2 min after ~15 min idle.
2. **Frontend on a static host (Netlify/GitHub Pages) + API on Render.**
   + Fast static frontend.
   − Cross-origin cookies and CSRF; Safari blocks third-party cookies.
3. **No deploy; `cloudflared` quick tunnel from the demo laptop.**
   + Zero setup, no account.
   − Public only while the laptop is on.

## Decision
- **Local prerequisites:** JDK 21 (Temurin) and Node LTS, versions documented in README (`.nvmrc` for Node; `maven.compiler.release=21` in the POM). Neither Maven Wrapper nor npm installs a JDK.
- **Local start:** `npm install && npm run dev` (one line in README). `scripts/dev.mjs` checks `java -version` with a clear message, then runs `mvnw` (macOS/Linux) or `mvnw.cmd` (Windows) with profile `dev` (embedded Postgres, Flyway, seed; ADR-0004) alongside Vite (5173). Vite proxies `/api` to Spring (8080). Fallback: run the two commands in separate terminals.
- **Public:** Option 1 when the team decides to deploy.
  - Dockerfile stages: (1) Node builds `frontend/dist`; (2) Temurin JDK + `mvnw package` copies the build into `static/`; (3) Temurin JRE runtime.
  - A controller forwards non-API, non-file paths to `index.html` (SPA routes).
  - `JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=75 -XX:+UseSerialGC -Xss512k`.
  - Env: `SPRING_DATASOURCE_URL/USERNAME/PASSWORD` (Neon), `SPRING_PROFILES_ACTIVE=prod`.
  - Flyway runs on startup.
- **Fallback:** Option 3 if Render is unavailable on demo day. Warm Render up 5 minutes before any demo.

## Consequences
- **Simpler:** one artifact and one URL; deploy from `main` via Render's GitHub integration; nobody needs Docker locally.
- **Harder:** two runtimes on every laptop (R-M08); the JVM may run out of memory on 512 MB (R-T15); cold start takes ~1–2 min (R-T02); one person must own the Render and Neon accounts (R-M05).
- **Postponed:** preview deployments per PR, custom domain, monitoring/alerts, native image (GraalVM) for faster start.

## Related stories
US-01.1 (root address), US-31 ("immediately available"), all stories for the demo.
