# ADR-0012: Buyer accounts and moving «Вподобане» to the server

## Status
Proposed — 2026-10-28 (revised the same day: one session cookie, see ADR-0006; Java backend)

## Context
Product decision (28 Oct 2026): a buyer can swipe without an account and «Вподобане» is kept in the browser. **If the buyer registers, the likes move to the server.** This brings buyer registration and login (US-02, US-03, now In Scope in `requirements.md`) into the MVP. For registered buyers it overrides digest assumption A-09.
Constraints that still hold: no registration before the feed (BR-03), every buyer function works anonymously (NFR-01), no duplicates (INV-04).
Key fact: favourites are **append-only** in the MVP (removal, US-17, is Out of Scope). Merging two favourite lists is therefore a plain set union with no conflicts.

## Options
1. **Only favourites move to the server, merged by product ID; viewed progress stays in the browser.**
   + One idempotent endpoint handles the merge on login, a single like, and retries. With append-only favourites there is nothing to resolve.
   − Progress is per device: on a new device the buyer sees skipped cards again. Liked cards stay hidden, because favourites are known.
2. **Favourites and all viewed progress (every like/skip) move to the server.**
   + Full continuity across devices.
   − A write on every swipe to a free host that sleeps; a fast-growing table; more scope in a 7-week plan.
3. **An anonymous server ID from the first visit (cookie); registering just claims it.**
   + No migration step.
   − Server data for every visitor who never registers, which goes against NFR-19. A merge is still needed for a second device.

## Decision
Option 1.
- **Data:** `buyer_accounts(id, email UNIQUE (normalized), password_hash)` and `favorites(buyer_id, product_id, created_at, PRIMARY KEY (buyer_id, product_id))`. Auth (Spring Security, BCrypt, in-memory server sessions) is shared with brands (ADR-0006). The account tables are separate, and there is **one session cookie** whose principal records the account type.
- **API:** `POST /api/buyer/register|login|logout`; `GET /api/me/favorites`; `POST /api/me/favorites` with `{ productIds: uuid[] }` (max 500) → `INSERT … ON CONFLICT DO NOTHING` via `JdbcClient` (ADR-0004), unknown IDs ignored, returns the full list. The same endpoint is used for a single like and for the merge.
- **Merge on register/login:** the client sends its local `favoriteIds`; the response (server ∪ local) replaces the local set.
- **Like while logged in:** the local set is updated first (instant counter, US-09 S1), then `POST [id]`. If the request fails, the ID stays local and is re-sent on the next sync (app start, window focus). Double clicks are harmless thanks to the primary key.
- **Feed:** cards in `favoriteIds` count as viewed, so the buyer never sees an already-liked card again on any device.
- **Logout:** clear local favourites and progress (shared-device privacy); the buyer is anonymous again.
- **Entry points:** a call to action in «Вподобане» and in the navigation, **never** in front of the feed (BR-03). The form says what is stored: email and liked products.
- The same email may be both a buyer and a brand (separate tables). In one browser only one of them is logged in at a time; logging in as the other replaces the session (ADR-0006).

## Consequences
- **Simpler:** the merge is a union, there are no conflicts, and retries are safe. Duplicates are impossible at the DB level.
- **Harder:** +3 screens, +5 endpoints, a second account type in the security config. We now store buyer personal data, so NFR-19 changes and a short privacy note is needed. Scope pressure on the deadline (R-M01). Merge tests are required: two devices, a double click while logged in, a failed request then a retry.
- **Postponed:** removing favourites (US-17 would need tombstones, because a union would bring removed items back), cross-device viewed progress, password reset, email verification, social login.
- **Done:** US-02 and US-03 moved to In Scope with acceptance criteria for the favourites transfer; digest A-09 and NFR-19 updated (28.10.2026).

## Related stories
US-02, US-03 (moved into the MVP), US-01.2, US-09, US-16, US-19.
