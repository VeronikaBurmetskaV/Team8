# ADR-0010: Deployment and hosting — local demo; Render + Neon as a documented optional step

## Status
Proposed — 2026-10-28 (revised: Java backend; then simplified: no deployment for the demo)

## Context
The demo runs locally. A public URL was nice-to-have, but deploying a JVM to a free host adds work (Dockerfile, memory tuning, cold starts, accounts) that does not serve any story. Local start must be as simple as possible after `git clone`, without Docker. No bank card. The buyer journey is shown on a phone (US-01.1: from 320 px).

## Options
1. **Local only for the demo; Render + Neon documented as an optional step.**
   + No accounts, no Dockerfile to maintain, no cold start or 512 MB tuning; the team spends the time on stories.
   − No public link for reviewers; the phone demo needs the laptop on the same network.
2. **Render free web service (Dockerfile built on Render) + Neon, as part of the plan.**
   + A public URL.
   − JVM memory tuning on 512 MB, ~1–2 min cold starts, in-memory sessions lost on every sleep (ADR-0006), account ownership.
3. **`cloudflared` quick tunnel from the demo laptop.**
   + A temporary public URL with no account and no deploy.
   − Public only while the laptop runs.

## Decision
Option 1, with Option 3 as the way to share a temporary link.
- **Prerequisites:** JDK 21 (Temurin) and Node LTS, versions documented in README (`.nvmrc` for Node; `maven.compiler.release=21` in the POM). Neither Maven Wrapper nor npm installs a JDK.
- **Local start:** `npm install && npm run dev` (one line in README). `scripts/dev.mjs` checks `java -version` with a clear message, then runs `mvnw` (macOS/Linux) or `mvnw.cmd` (Windows) with profile `dev` (embedded Postgres, Flyway, seed; ADR-0004) alongside Vite (5173). Vite proxies `/api` to Spring (8080), so the browser sees one origin. Fallback: run the two commands in separate terminals.
- **Phone demo:** Vite started with `--host`; the phone opens `http://<laptop-ip>:5173` on the same Wi-Fi. Cookies work because the proxy keeps one origin. Otherwise use Chrome device emulation, or a `cloudflared` quick tunnel.
- **Optional step (documented, not planned): Render + Neon.**
  - Multi-stage Dockerfile built on Render: Node builds `frontend/dist`; Temurin JDK + `mvnw package` copies it into `static/`; Temurin JRE runtime.
  - A controller forwards non-API paths to `index.html`.
  - `JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=75 -XX:+UseSerialGC -Xss512k`; `server.forward-headers-strategy=framework`; `Secure` session cookie.
  - Env: `SPRING_DATASOURCE_URL/USERNAME/PASSWORD` (Neon, no card), `SPRING_PROFILES_ACTIVE=prod`.
  - With in-memory sessions, users re-login after each sleep. Add Spring Session JDBC first if that matters (ADR-0006).

## Consequences
- **Simpler:** no hosting accounts, no Dockerfile in the critical path, no production-only bugs; one runtime environment (the laptop).
- **Harder:** two runtimes on every laptop (R-M08); the demo depends on one laptop and the local network (R-M09); reviewers can't open the app on their own.
- **Postponed:** public hosting (Render + Neon), the Dockerfile, preview deployments, monitoring.

## Related stories
US-01.1 (root address, 320 px), US-31 ("immediately available"), all stories for the demo.
