# ADR-0015: Brand logos on the home page brand tiles — `GET /api/brands`, consent only

## Status
Proposed — 2026-11-25. Narrows US-08.2 CL («the logo is never shown to buyers») for the «Бренди» block of the home page only; product cards (`PublicCard`) stay without a logo. Needs the team lead's decision: it adds a public endpoint and shows brand material outside the card.

## Context
The home page shows a square tile per brand (`BrandTiles`). Without a logo each tile is a coloured monogram, which makes brands hard to recognise. Registered brands can save a logo in their profile (US-22.1), but `PublicCard` never carries it (US-08.2 CL), and putting it on every card would repeat it ~30 times per brand. A logo is brand material: showing it needs the brand's consent (US-22.2, A-17). Imported demo brands (ADR-0014) have no profile and no consent; their sites do have a logo.

## Options
1. **Keep monograms only (status quo).**
   \+ No new endpoint, US-08.2 CL untouched.
   − Brands are hard to recognise on the tiles.
2. **Add `logoUrl` to `PublicCard`.**
   \+ One request.
   − Breaks US-08.2 CL for every card; repeats the logo in every item; tempts the UI to show it on cards.
3. **A separate public `GET /api/brands` with the logo only under consent (chosen).**
   \+ Cards stay as they are; one small request per page; the consent rule sits in one SQL/service place.
   − A second public read; the client must match brands by key.

## Decision
Option 3:
- `GET /api/brands` → `[{ key, name, logoUrl | null, productCount }]` for every brand with Published cards (api.md §2.2). Only Published cards are counted (INV-01).
- **Registered brands:** `logoUrl` = the profile's `logoDisplayUrl` only in state `CONSENTED`; otherwise `null`. (Publishing needs consent, so a listed brand is consented in practice; the check still guards against inconsistent data.)
- **Imported brands (dev demo):** the source site's logo URL found by the importer (ADR-0014, `catalog_sources.logo_url`), only for a single-brand source (a marketplace logo is not the brand's), only when `fulla.brands.source-logos=true`, which is set in `application-dev.yml` only. `prod` and `ops` return `null`.
- `key` follows the client's `brandKey` rules; owners with the same key are one entry (counts added, the larger owner's name, a registered logo before a source logo).
- Logos are hot-linked: no copies, no proxy. The client loads them with `loading="lazy"` and `referrerPolicy="no-referrer"`, accepts only `https://` and `/api/images/` URLs and falls back to the monogram when there is no URL or the image fails.

## Consequences
- **Simpler:** recognisable brand tiles without touching the card contract or the swipe feed.
- **Harder:** a second public endpoint to keep in sync with the feed; brand keys are computed on both sides (same examples in JUnit and Vitest). While `PUT /api/brand/profile` still refuses logos ("not supported yet"), registered brands get `null` in practice.
- **Postponed:** logo upload in the brand profile (US-22.1 logo part); caching or proxying logos; logos anywhere else (brand page, cards).

## Related stories
US-08.2 (CL narrowed for the tiles), US-22.1 (logo), US-22.2 (consent), US-20 (brand page, Out of Scope — not implemented here). ADR-0007, ADR-0014, A-17.
