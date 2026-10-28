# ADR-0008: Frontend stack

## Status
Proposed — 2026-10-28 (revised the same day: typed client from OpenAPI, UI texts keyed by error code)

## Context
Two FE developers with basic JS/React, writing TypeScript (ADR-0013). The hard parts are:
- the swipe gesture with button parity (US-09, US-10);
- «Вподобане» and viewing progress surviving reload and return to start without an account (US-01.2 S2, US-09 S2, A-09), and moving to the server when the buyer registers (ADR-0012);
- refetching the feed when brands publish or unpublish (ADR-0009);
- cabinet and buyer-account forms with exact Ukrainian error texts, while the API returns only error codes (ADR-0005).

## Options
1. **Vite + React Router + TanStack Query + `openapi-fetch` + CSS Modules + `motion` + Zustand (`persist` → localStorage) + react-hook-form/zod.**
   + Each library covers exactly one hard part; all are mainstream and well known to Claude Code; API calls are typed from the generated schema.
   − Several libraries to learn, each with a narrow API.
2. **Same, but Tailwind + Mantine instead of CSS Modules.**
   + Cabinet forms appear fast.
   − New syntax; the component library fights the custom swipe card; changes designer handoff.
3. **Minimal: `fetch`/`useEffect`, Context, hand-written pointer events, hand-written API types.**
   + Fewer dependencies.
   − Races, manual refetching, a gesture engine from scratch, and API types that drift.

## Decision
Option 1.
- **Routes:** `/` (start), `/feed`, `/favorites`, `/register`, `/login` (buyer), `/brand/register`, `/brand/login`, `/brand/profile`, `/brand/products`, `/brand/products/:id` (edit + preview).
- **API client:** `src/api/client.ts` = `openapi-fetch` typed by `src/api/schema.d.ts` (generated, ADR-0003), with a middleware that adds the `X-XSRF-TOKEN` header (ADR-0006).
- **Error texts:** `src/shared/messages.uk.ts` exports `Record<ErrorCode, string>` with the exact strings from the stories. Forms map `error.code` and `error.fields` to these texts.
- **Form validation:** react-hook-form + zod schemas in `src/shared/validation.ts`, mirroring the Bean Validation rules for instant feedback. The API stays the authority (R-T17).
- **Buyer session store** (`features/feed/session.ts`): `{ viewedIds, favoriteIds }`, persisted under one localStorage key with a `version` field. Other tabs sync via the `storage` event. For a logged-in buyer, the store stays the instant local copy and a TanStack mutation syncs it to `/api/me/favorites` (ADR-0012).
- **Swipe:** `motion` drag on the top card; release past a threshold (or a button press) calls the **same** `like(id)` / `skip(id)` action (BR-11).
- **Styles:** CSS Modules + design tokens as CSS variables from the designer.
- **`ProductCard`** lives in `src/shared/ui` and is used by the feed, «Вподобане» and the brand preview (NFR-17).
- **Outbound links** are built only by `withUtm()` in `src/shared/links.ts` and rendered as `<a target="_blank" rel="noopener noreferrer">`. The backend stores the brand's URL unchanged.

## Consequences
- **Simpler:** persistence, refetching, gestures and API typing are library features, not our code.
- **Harder:** validation rules exist in both zod and Bean Validation; tests must use the same examples (ADR-0011). localStorage can be cleared by the browser (Safari after 7 days without a visit), which loses an **anonymous** buyer's favourites (R-P05, accepted; registered buyers are covered by ADR-0012).
- **Postponed:** PWA/offline, animations beyond the swipe, i18n (UI is Ukrainian only).

## Related stories
US-01.2, US-02, US-03, US-08.1, US-08.2, US-09, US-10, US-16, US-19, US-21, US-21.1, US-22.1, US-22.2, US-25.1, US-25.2, US-26, US-31.
