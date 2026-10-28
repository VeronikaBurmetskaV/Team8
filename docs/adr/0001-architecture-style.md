# ADR-0001: Architecture style — React SPA served by a Spring Boot API, package-by-feature

## Status
Proposed — 2026-10-28 (revised the same day: backend language changed to Java)

## Context
Two Java developers and two React developers, all at a basic level, have ~7 weeks. The MVP has two halves that barely touch: the buyer flow (feed, «Вподобане», optional account, redirect) and the brand cabinet (registration/login, profile, cards, publishing). Claude Code writes most of the code, so "where does this go?" must have one obvious answer. Auth uses a session cookie (ADR-0006), which is simplest on one origin.

## Options
1. **React SPA built into the Spring Boot app (one origin); package-by-feature backend, feature folders in the frontend.**
   + Each pair owns one folder; the contract (`docs/contracts/api.md`, ADR-0005) is explicit; no CORS.
   − The frontend build must be copied into the JAR for deploys (ADR-0010).
2. **SPA and API deployed separately.**
   + Independent deploys.
   − Cross-origin cookies, CORS and CSRF across sites; Safari blocks third-party cookies.
3. **Clean/hexagonal backend.**
   + Testable domain, swappable infrastructure.
   − Ports and adapters for ~7 tables; only one adapter is really needed (`ImageStore`, ADR-0007).

## Decision
Option 1.
- Backend `ua.fulla.<feature>`, each package with `XController → XService → XRepository` and request/response records. Features: `brandauth`, `brandprofile`, `products`, `feed`, `images`, `buyer` (accounts + favourites). `ua.fulla.common` holds the error envelope, security config and web config. A package uses another feature only through its service.
- Frontend `frontend/src/features/<feature>/` (`start`, `feed`, `favorites`, `buyer-auth`, `cabinet-auth`, `cabinet-profile`, `cabinet-products`) + `src/shared/` (UI kit, API client, `ProductCard`, messages, links).
- One deliberate abstraction: `ImageStore`. No other interfaces "for the future".

## Consequences
- **Simpler:** both pairs work in parallel from week 1 against `docs/contracts/api.md`. A story maps to one package and one feature folder, so Claude Code prompts can name them.
- **Harder:** the contract must be agreed before screens are wired; the two apps are deployed as one artifact (ADR-0010).
- **Postponed:** domain isolation, multiple services.

## Related stories
All MVP stories; buyer: US-01.1…US-19, US-02, US-03; brand: US-21…US-32, US-21.1.
