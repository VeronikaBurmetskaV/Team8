# ADR-0017: Import of products from the brand's own website, at the brand's request

## Status
Proposed — 2026-11-25; revised 2026-11-25 (demo mode in profile `dev`, see «Demo mode»). Narrows A-15 ("the server never fetches brand URLs"): the server may fetch the **website of a brand whose ownership of that site is verified**, only when that brand asks for an import (or for the daily refresh of an import it started). Brings parts of the Out-of-Scope US-23, US-24, US-27…US-30 into the product (new items arrive as drafts, not published as US-29 asks). Extends ADR-0014 (its fetcher and parsers are reused); ADR-0014 itself stays dev-only. Adds an exception to INV-10 (see Decision). Needs the team lead's decision: it changes scope, A-15 and the schema.

## Context
Brands fill their cards by hand (US-25.1), which takes about two minutes per card; a brand with 50 items needs almost two hours before its catalogue is visible. ADR-0014 showed that most Ukrainian shops expose machine-readable products (a Google/Facebook feed, Shopify's `/products.json`, or `sitemap.xml` + JSON-LD `Product`), and that they can be read politely. It deliberately postponed import for registered brands because three things were missing: the brand's **request**, proof that the requester **owns the site**, and an **SSRF review** of server-side fetching. A-15 exists because fetching arbitrary user-supplied URLs lets anyone point our server at internal addresses or at third-party sites.

## Options
1. **Keep A-15 as it is (manual cards only).**
   \+ No network code outside the dev demo; nothing to secure.
   − Onboarding stays slow; brands with a catalogue have no reason to stay.
2. **Import from any `websiteUrl`, no ownership check.**
   \+ Simplest for the brand.
   − Anyone can make FULLA fetch any site (and copy a competitor's catalogue into drafts); SSRF surface on every profile save.
3. **Import only from a verified site, on the brand's request, through one hardened fetcher (chosen).**
   \+ The brand's own action plus the ownership proof is its consent to the fetch; the fetch surface is one class with tests.
   − Verification step for the brand; new tables/columns; parsers can break when a site changes.

## Decision
Option 3, with these binding rules:

- **Who may trigger a fetch:** only a logged-in brand, only for the domain of its own `websiteUrl`, only after the site is verified. No endpoint fetches an arbitrary URL; product, image and logo URLs entered by brands are still **never** fetched (A-15 unchanged for them). The daily refresh runs only for brands with a verified site and at least one imported card.
- **Ownership (one of):** (a) `<meta name="fulla-verification" content="<token>">` on the home page; (b) `https://<host>/fulla-verification.txt` containing the token; (c) the brand's email domain equals the site domain (or the site is a subdomain of it), unless the email domain is in the configured list of public mail services (`fulla.brand-import.public-email-domains`). The token is random per profile (`brand_profiles.verification_token`). Verification stores `site_verified_at` and `site_domain` (the host without `www.`). Changing `websiteUrl` to another domain clears both. **Known weakness of (c):** emails are not verified in the MVP (postponed in ADR-0006), so (c) trusts what the brand typed; it can be switched off with `fulla.brand-import.email-domain-verification=false` and should be off once anything is published.
- **Hardened fetcher** (`PoliteFetcher`, shared with ADR-0014): `https` and port 443 only, no user info in URLs; the host must be the verified domain or its subdomain; the host is resolved and **every** address must be public (no loopback, private, link-local, CGNAT, ULA `fc00::/7`, multicast, documentation, reserved, IPv4-mapped/NAT64 forms of those); the checks repeat on every redirect (max 3); 15 s timeout; body caps (page 3 MB, feed/sitemap 30 MB, `products.json` 10 MB); allowed `Content-Type` list; User-Agent `FULLA-bot/1.0 (+<bot info URL>)`; robots.txt for the token `FULLA-bot`; ≥ 2 s between requests; ≤ 100 requests per import; no retries; 403/429/bot challenge stops the run. Residual risk: DNS rebinding between our check and the JDK's own lookup; it is limited by the JDK's 30 s positive DNS cache, which the `HttpClient` lookup hits right after ours.
- **Finding products** — the first source that yields products: the brand's feed URL (`feedUrl`, optional, same domain; Google/Facebook XML) → Shopify `/products.json` → `sitemap.xml` (and sitemap index) → product pages with JSON-LD `Product`. One generic importer; no site-specific parsers. Clothing only (the ADR-0014 filter), prices in UAH only, ≤ 50 products per import (`fulla.brand-import.max-products`).
- **Storage:** imported items are the brand's own **Draft** cards (`brand_id`, `external_id` = product URL path, `source_url`); sizes with availability, colours, material and description are stored like ADR-0014's. Photos stay `https://` URLs (never downloaded). A re-import updates the cards, never duplicates them (`UNIQUE (brand_id, external_id)`). Fields the brand edited by hand (`edited_fields`) are never overwritten. Items missing from a **complete** listing, or sold out, are unpublished (never deleted); after an incomplete run nothing is hidden. The import never publishes.
- **INV-10 exception:** the import may update the price, sizes, availability and texts of a Published imported card (the site is the brand's own, and stale prices are worse for buyers). Brand edits of Published cards stay forbidden (T-3).
- **Publishing:** the same gate as every card (T-1, consent required), one card or many (`POST /api/brand/products/publish`).
- **Frequency:** one import per brand per 10 minutes (`brand_imports.started_at`, conditional `UPDATE` as in ADR-0009); the daily refresh uses the same claim.
- **Profiles:** the brand import and its scheduler run in every profile. ADR-0014's demo importer stays `dev`-only and unchanged in scope.
- **Demo mode (revised 2026-11-25):** `fulla.brand-import.require-site-verification` (default `true`) is `false` only in `application-dev.yml`. Then a brand imports from the website in its profile **without** proving ownership, like the ADR-0014 demo import: local development only, and the same rule applies — while such data is in the DB the demo is not published (no Render deploy, no `cloudflared` link). With profile `prod` or `ops` active the check is **always** required, whatever the setting (`SiteVerificationPolicy`). Without verification outside demo mode `POST /api/brand/import` answers `403 SITE_NOT_VERIFIED`. The hardened fetcher (https/443, public addresses, robots.txt, pauses, caps) applies in demo mode too; only the ownership check is skipped. `GET /api/brand/import/status` tells the client `verificationRequired` / `demoMode`.

## Consequences
- **Simpler:** a brand with a shop gets its catalogue as drafts in minutes; prices and stock follow the site.
- **Harder:** server-side fetching is now a production feature: the fetcher's guards must keep their tests; new error codes, a `brand_imports` table and five new columns; parsers depend on third-party markup. Hiding sold-out items automatically means a brand's published card can disappear without the brand acting.
- **Postponed:** email verification (which would make method (c) safe), YML (Prom/Rozetka) feeds, WooCommerce REST, image copies or a proxy, per-brand schedules, showing sizes/composition on the card beyond `GET /api/feed` (US-13…US-15).

## Related stories
US-25.1, US-26, US-31, US-22.2 (consent before publishing); Out of Scope until now: US-23 (connect a site), US-24 (import), US-27 (size availability), US-28 (sold-out items leave the feed), US-29 (new items — here as drafts only), US-30 (prices). A-15, ADR-0006, ADR-0007, ADR-0009, ADR-0014.
