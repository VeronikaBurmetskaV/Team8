# FULLA — External Dependencies and Integrations (MVP)

The MVP has **no API integrations with third parties**. Every external dependency is either a plain link/URL rendered for the buyer, or infrastructure (DB, hosting).
Rule (A-15, ADR-0009): **the FULLA server never makes requests to brand websites** for anything brand-facing: brand-entered product URLs, image URLs and logos are never fetched, checked or proxied.
**Only exception (ADR-0014, Proposed): the dev-profile demo importer** reads three fixed sources (Всі. Свої XML feed, One By One, Cher'17) to fill the local demo feed. It runs only with `@Profile("dev")` and `fulla.import.enabled=true`, never in `ops`/`prod`/tests, and the demo with imported data is never published. See §7.

## Overview

| Dependency | Kind | What we take from it | Who calls it | When it is needed |
|---|---|---|---|---|
| Brand product pages | Link only | Nothing. We store the URL and add `utm_source=fulla` | Buyer's browser (new tab) | US-19, US-26, US-32 |
| Demo import sources: vsisvoi.ua, onebyone.ua, cher17.com | Server fetch, **dev profile only** (ADR-0014) | robots.txt, XML feed / sitemap, product pages (JSON-LD + HTML sizes); ≤ 50 items per source; images not copied | `ua.fulla.catalogimport` (`@Scheduled`, ≤ 1 run / 6 h) | Local demo only (§7) |
| Brand-hosted image URLs | Link only (`<img src>`) | The image bytes, loaded by the browser | Buyer's / brand's browser | US-22.1, US-25.1 (URL variant) |
| Image storage | Internal (Postgres) | — | Our API | US-22.1, US-25.1 (upload variant) |
| Database | Infrastructure | Data storage | Our API | Always |
| Hosting (Render) | Infrastructure, optional step, not used for the demo | Building the Docker image, running the Spring Boot JAR, TLS, URL | — | Public demo only |
| GitHub, Maven Central, npm registry, JDK/Node installers | Dev-time | Code, CI, Java and JS packages, embedded Postgres binaries, runtimes | Developers, CI | Development only |

---

## 1. Brand websites: product pages (US-19, US-26, US-32)

- **What:** a URL entered by the brand (`http://` or `https://`, format-checked by `@HttpUrl` Bean Validation on the API and the same rule in the frontend form; ADR-0009). FULLA renders it as `<a target="_blank" rel="noopener noreferrer">` with `utm_source=fulla` added by the frontend's `withUtm()` (query merged with `&`, inserted before `#fragment`, left as-is if `utm_source` exists — A-16).
- **Kind:** link only. No API, no scraping, no status checks of brand-entered URLs. The brand sees FULLA traffic in its own analytics via the UTM tag (US-32 CL). (The dev-only demo importer, §7, reads its three fixed sources; it never checks brand-entered URLs.)
- **If the brand site is down or the page returns 404:**
  - FULLA cannot know (no server fetch of brand-entered URLs). The buyer sees the brand's error page **in a new tab**; the FULLA tab, feed position and «Вподобане» stay intact (BR-20).
  - Before publishing, the brand checks the link with «Перевірити посилання» (US-26 S1), which opens it in the brand's own browser.
  - After a product sells out or its URL changes, the brand unpublishes it (US-31) and, if needed, edits and republishes it (A-06).
  - The inactive button «Тимчасово недоступно на сайті бренду» (US-19 S2) appears when the URL is invalid or the card is no longer published (`available=false`, ADR-0009). It does **not** reflect whether the brand site is up.
- **Accepted risk:** R-P06.

## 2. Brand-hosted image URLs (logo US-22.1, product photo US-25.1)

- **What:** an image URL stored as-is; the browser loads it directly (hot-link).
- **Kind:** link/format only. We store no copy.
- **Constraint:** only `https://` image URLs, because an `http://` image on the HTTPS deployed site is blocked or auto-upgraded by browsers (mixed content). This rule is now in the US-22.1 and US-25.1 checklists.
- **If unavailable** (deleted, 404, hotlink protection, slow): the card shows a placeholder; name, brand, price and buttons keep working (BR-10). In the brand preview, the specific message «Зображення не завантажилося — перевірте файл або посилання на фото перед публікацією» is shown (BR-47).
- **Side effect:** the buyer's browser contacts the brand's server, which sees the buyer's IP. FULLA itself stores nothing about anonymous buyers (NFR-19).

## 3. Image storage (uploads)

- **What:** uploaded PNG/JPG/WEBP (≤ 5 MB, resized in the browser) stored in Postgres and served by `GET /api/images/{id}` (ADR-0007).
- **Kind:** internal; no external service in MVP.
- **If unavailable:** it fails together with the DB (see §4). In the browser the `<img>` error shows the placeholder.
- **Future:** a Cloudinary adapter behind `ImageStore` if storage grows (R-T04).

## 4. Database

- **Local:** embedded Postgres (zonky `embedded-postgres`), started by the Spring `dev` profile from binaries downloaded as a Maven dependency on first run; data in `backend/.data/pg`. No Docker, no account; offline after the first build.
- **Deployed (optional step, ADR-0010):** Neon Postgres free tier (no card), via `SPRING_DATASOURCE_URL` (TLS). Neon suspends idle compute; the first query after idle takes slightly longer.
- **Kind:** infrastructure (Postgres protocol), not a product integration.
- **If unavailable:** Spring Boot does not start without the DB (Flyway runs on startup). If the DB drops while running, the API returns `503` with the envelope `{ error: { code: "SERVICE_UNAVAILABLE" } }`. The feed and «Вподобане» show an error state with a retry button. The buyer's local favourite IDs are kept in localStorage and appear again once the DB is back. Cabinet forms keep the entered data.

## 5. Hosting

- **Not used for the demo.** The demo runs on a laptop (ADR-0010); the phone opens it over the same Wi-Fi.
- **Render free web service** (documented optional step, ADR-0010): builds the multi-stage Dockerfile on Render (no local Docker) and runs the Spring Boot JAR with the React build inside; one origin serves the SPA and `/api`. 512 MB RAM (R-T15); in-memory sessions are lost on every sleep (ADR-0006).
- **If unavailable or asleep:** cold start ~1–2 min (R-T02); a `cloudflared` quick tunnel from the laptop gives a temporary link instead (no account). The local launch never depends on hosting.

## 6. Development-time dependencies

- **GitHub:** repository, PRs, GitHub Actions CI (ADR-0011). If GitHub Actions is down, merges wait; local `./mvnw verify` and frontend tests still work.
- **Maven Central:** Java dependencies and the embedded Postgres binaries; versions pinned in `pom.xml`; the Maven Wrapper downloads Maven itself. Needed for the first build only.
- **npm registry:** frontend and root script packages; `package-lock.json` is committed so all 6 laptops get the same versions.
- **JDK 21 and Node LTS installers:** installed once per laptop (R-M08); not downloaded by the build.
- **Fonts:** if the design uses web fonts, they are installed via npm (`@fontsource/*`) and bundled, not loaded from a font CDN, so the local app works offline.

---

## 7. Demo catalogue import (ADR-0014, Proposed, profile `dev` only)

- **What:** fills the local demo feed with real cards from three fixed sources, configured in `application-dev.yml` (never via API or UI):

  | Source | Read | robots.txt |
  |---|---|---|
  | Всі. Свої (`https://vsisvoi.ua`) | `/facebook-feed.xml` (Google Merchant XML: sizes with availability, colour, brand, price, image) | feed explicitly allowed |
  | One By One (`https://onebyone.ua`) | `sitemap.xml` → product pages: JSON-LD `Product` + sizes from HTML | product pages allowed; `?page=`, filters, search disallowed |
  | Cher'17 (`https://cher17.com`) | `sitemap.xml` (`/product/…` only) → JSON-LD `Product` + sizes from HTML | `/product/…` allowed |

- **Who calls:** `ua.fulla.catalogimport` in the backend, via the JDK `HttpClient`; HTML parsed with Jsoup. Exists only under `@Profile("dev")` and `fulla.import.enabled=true`.
- **Limits:** robots.txt first (skip the source if it can't be read); ≥ 2 s between requests, one at a time; honest User-Agent `FULLA-demo-importer/0.1`; ≤ 1 run per source per 6 h (stored in the DB); ≤ 50 products and ≤ 100 requests per source per run; `https` and the source host only; size caps; stop the source on 403/429/challenge.
- **Images:** never downloaded; cards keep the source's `https://` image URL, so the buyer's browser hot-links it (same side effects as §2).
- **If unavailable:** the run is marked `partial`/`failed`, existing imported cards stay as they are, and nothing is unpublished. The feed still works from brand and seed cards.
- **Not published:** while imported data is in the DB, the demo runs on the laptop / same Wi-Fi only; no Render deploy and no `cloudflared` link (brand content without consent).
- **Data:** `data-model.md` §5 (source brands without accounts, import columns on `products`).

## Future integration (Out of Scope): automatic import from brand sites

US-23, US-24, US-27–US-30 (connect a site, import products, sync availability and prices, auto-remove sold-out items) are **Post-MVP**. They are listed here only to show what the MVP design must not block. The dev-only demo importer (§7, ADR-0014) does **not** implement them: it has no brand settings, no consent and no production use, but its adapters and SSRF limits are a starting point.

| Possible source | Notes |
|---|---|
| Product feeds (Google Merchant XML, YML used by Prom/Rozetka) | Most realistic for Ukrainian shops; one parser per format. |
| Shop platform APIs (Shopify, WooCommerce REST, Horoshop) | Structured data; needs per-brand credentials or app install. |
| HTML scraping | Fragile and legally risky; last resort. |

What import would add to the architecture: a scheduled job (free hosts sleep, so a separate cron service is needed); server-side fetching of brand URLs, with SSRF protection; per-brand integration settings; a mapping from imported items to `products` (status, price, sizes). The MVP keeps this possible by owning product data in its own `products` table and having a single package (`ua.fulla.products`) that changes card status. An import job would run as a separate scheduled service, or an external cron calling an API endpoint.
