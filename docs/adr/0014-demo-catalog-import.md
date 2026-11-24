# ADR-0014: Demo catalogue import from three brand/shop sites (dev profile only)

## Status
Proposed — 2026-11-17. Partially overrides A-15 ("the server never fetches brand URLs"), **only** for the local demo (profile `dev`). For every other profile and for the brand-facing product, A-15, ADR-0009 and the Out-of-Scope list (US-23, US-24, US-27…US-30) stay as they are. Needs the team lead's decision: it changes scope, adds a dependency and a second interface besides `ImageStore`.

## Context
The demo feed needs realistic cards from real Ukrainian brands. Without them it runs on the dev seeder (≥ 4 fake brands, ~30 cards). The research in `parsing-research.md` (17.11.2026, not in git) checked six sites. Three are cheap and predictable to read:

| Source | What it offers | robots.txt |
|---|---|---|
| **Всі. Свої** — `https://vsisvoi.ua` (a marketplace of Ukrainian brands) | XML feed `/facebook-feed.xml` (Google Merchant format): title, price, image, link, brand, colour, size, availability, material; one item per size, grouped by `item_group_id` | `/facebook-feed.xml` explicitly allowed |
| **One By One** — `https://onebyone.ua` (OpenCart) | `sitemap.xml` with product URLs; JSON-LD `Product` (name, description, image, price, availability); sizes and composition in HTML | product pages allowed; `?page=`, filters, search disallowed |
| **Cher'17** — `https://cher17.com` (Laravel) | `sitemap.xml` (`/product/…` mixed with category URLs); JSON-LD `Product` (name, brand, images, description, `AggregateOffer.lowPrice`); sizes in HTML | `/product/…` allowed; `/cart`, `/order`, `*/price` disallowed |

Rejected by the research: Lacoste (Next.js/Akinon, data in the RSC stream, JSON-LD not confirmed), Natali Bolgar (no JSON-LD `Product`, HTML only), Guess (Cloudflare challenge returns 403 even on robots.txt; no Ukrainian domain; not a Ukrainian brand).

Constraints: no account and no budget; local laptop demo (ADR-0010); no Docker; the site is never published. Imported photos and texts belong to the brands, and they have **not** given consent (US-22.2).

## Options
1. **Keep only the seeder and hand-made cards (status quo).**
   \+ Zero risk; A-15 is untouched.
   − The demo looks synthetic; filling ~150 realistic cards by hand takes about a day of manual work.
2. **One-off manual export: fetch once, commit a JSON/SQL fixture.**
   \+ No network code in the app.
   − Data goes stale in days (prices, stock); brand content gets committed to git (copyright); refreshing means repeating the whole manual job.
3. **A dev-only scheduled importer with three strict source adapters (chosen).**
   \+ Fresh, real data; respects robots.txt; nothing is published or stored beyond links and text fields.
   − New network code, a parser dependency, and schema additions for data the MVP UI doesn't show.

## Decision
Option 3, with these binding rules:

- **Scope:** exactly three sources (Всі. Свої feed, One By One, Cher'17), configured in `application-dev.yml`, never entered through the API or UI. No endpoint triggers an import.
- **Profile:** the importer beans exist only under `@Profile("dev")` and `fulla.import.enabled=true` (default `false`, so tests and offline starts don't touch the network). `@EnableScheduling` sits on the importer's own config class. No importer code runs in `ops`, `prod` or tests.
- **Not published:** the demo with imported cards runs on the laptop / same Wi-Fi only. The optional Render + Neon deploy (ADR-0010) and `cloudflared` links are **not** used while imported data is in the DB.
- **robots.txt:** fetched first in each run; the group for our User-Agent token, else `*`; longest-match `Allow`/`Disallow` with `*` and `$`. A disallowed URL is skipped, never retried another way. If robots.txt can't be read (non-2xx other than 404, or a timeout), the source is skipped for this run.
- **Politeness:** one request at a time per host, **≥ 2 s** between requests; honest User-Agent `FULLA-demo-importer/0.1` (no personal contact data); timeout 15 s; no retries in the same run; a response with 403/429/challenge stops the source for this run.
- **Frequency:** a source is refreshed **at most once per `fulla.import.min-run-interval`**: **6 hours** by default, **1 hour** in `application-dev.yml`, never below **10 minutes** (a smaller value is raised to 10 min). `last_run_at` is stored in the DB and the interval is bound as a query parameter of the conditional `UPDATE` (T-18), so restarting the backend doesn't trigger a new fetch. Why configurable: during development and before a demo the team needs fresher data (prices, stock) and a quicker check of importer changes than once per 6 h allows, while other environments keep the conservative default without code changes. The 10-minute floor keeps the load on the brands' sites small whatever is configured: at most 100 requests per source per run, ≥ 2 s apart.
- **Volume:** at most **50 products per source**, plus a hard cap of 100 HTTP requests per source per run.
- **Images:** never downloaded or copied. `photo_url` is the brand's `https://` URL as-is (ADR-0007, URL variant); a missing image shows the placeholder (NFR-10).
- **SSRF and safety:** only `https`; every fetched URL must have the configured source host (also after redirects, max 3); body size cap (feed 30 MB, pages 3 MB); XML parsed with StAX, DTD/external entities off; HTML descriptions turned into plain text (no HTML ever reaches the client).
- **Dependency:** add **Jsoup** (`org.jsoup:jsoup`) for HTML parsing only (size lists, JSON-LD `<script>` extraction, HTML → text). HTTP goes through the JDK `java.net.http.HttpClient`; JSON through Jackson (already in Spring Web); XML through JDK StAX. No other new libraries.
- **Card ownership:** imported cards belong to a *source brand* (no account, no login, no consent record). Card status still changes **only** in `ua.fulla.products`: the importer calls `ProductService`, never `ProductRepository`. Schema plan: `data-model.md` §5.
- **Feed:** imported cards are ordinary `PublicCard`s (`api.md`). The extra fields (sizes, colours, material, description) are stored but **not** added to the API or shown, because US-13…US-15 stay Out of Scope until a separate decision.

## Consequences
- **Simpler:** the demo shows ~150 real, current cards from 3 sources with no manual work. A-15 still holds for everything brand-facing and for every non-dev profile.
- **Harder:** a second interface besides `ImageStore` (`CatalogImporter`, ADR-0001 exception); a new dependency (Jsoup); `products` gets nullable import columns and an exception to T-1/T-2 (imported cards skip consent and the brand-name check). Parsers break when a site changes its markup, so tests run on saved fixtures and never hit the network. Legal exposure (texts, hot-linked photos without the brands' consent) is acceptable only because the demo is local and unpublished.
- **Postponed:** real import for registered brands (US-23, US-24, US-27…US-30) with consent, per-brand settings and SSRF review; showing sizes, colours or composition on the card (US-13…US-15); image proxy or caching; other sources (Lacoste, Natali Bolgar, Guess).

## Related stories
US-08.1, US-08.2 (feed content), US-19, US-32 (outbound link with `utm_source=fulla`). Touches the Out-of-Scope US-13…US-15 and US-23, US-24, US-27…US-30 without implementing them for brands. A-15, ADR-0001, ADR-0004, ADR-0007, ADR-0009, ADR-0010.
