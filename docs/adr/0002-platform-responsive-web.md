# ADR-0002: Platform — one responsive, mobile-first web app

## Status
Proposed — 2026-10-28

## Context
The buyer opens FULLA from a link on a phone and swipes cards (journey step 1, 3). The brand fills in forms and uploads files in a cabinet. The requirements say "root address" (US-01.1), "browser session" (US-09), "opens in a new tab" (US-19, US-26), 320 px+ (NFR-08). The brand preview must use "the same template and proportions" as the feed (US-25.2, NFR-17).

## Options
1. **Responsive web, mobile-first, React — buyer and cabinet in one app.**
   + Matches every requirement literally; one renderer for feed card and preview; 2 FE devs learn one stack.
   − The swipe must feel native in mobile browsers (scroll and gesture conflicts).
2. **React Native (Expo) buyer app + web cabinet.**
   + Native gestures and feel.
   − Two UI stacks; installing an app breaks the "open a link from a friend" journey; preview fidelity across stacks is impossible; app stores cost money.
3. **Web + PWA.**
   + Installable, home-screen icon.
   − A service worker cache risks showing stale or unpublished cards (US-31); there is no requirement for it.

## Decision
Option 1. Buyer screens are designed for 320–430 px first; the cabinet is designed for desktop first but must work on mobile. One `ProductCard` component renders the feed card, the favourites item and the brand preview.

## Consequences
- **Simpler:** one codebase, one deploy, NFR-17 met by construction, US-19 "new tab" is native.
- **Harder:** the swipe needs care with touch scrolling and the iOS back-swipe edge (R-T05).
- **Postponed:** PWA/install, push notifications, native apps.

## Related stories
US-01.1, US-01.2, US-08.1, US-08.2, US-09, US-10, US-16, US-19, US-25.2.
