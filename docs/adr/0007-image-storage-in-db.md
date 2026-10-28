# ADR-0007: Images — uploaded bytes in Postgres behind `ImageStore`; URLs kept as-is

## Status
Proposed — 2026-10-28 (revised the same day: Java implementation notes)

## Context
Logo (US-22.1) and product photo (US-25.1) accept **either an upload (PNG/JPG/WEBP, ≤ 5 MB) or an image URL starting with `https://`**. Budget is 0 UAH with no card. Free hosts have temporary disks, so files saved on the server disappear on restart or redeploy. Local start must work offline without Docker. Scale: demo, hundreds of photos (A-20).

## Options
1. **Bytes in Postgres (`images` table, `bytea`) behind an `ImageStore` interface.**
   + Same behaviour locally and deployed; no account; backups come with the DB.
   − Uses the DB quota (Neon free 0.5 GB); no CDN; images are served by our API.
2. **Cloudinary (free, no card) for deployed, disk locally, behind the same interface.**
   + CDN, on-the-fly resizing, no DB bloat.
   − Two code paths; keys and an account; local ≠ deployed.
3. **Local disk.**
   + Simplest code.
   − Files lost on every redeploy of a free host.

## Decision
Option 1.
- The browser resizes before upload (longest side ≤ 1600 px, WEBP, ~200–400 KB).
- The API (`POST /api/images`, multipart) enforces `spring.servlet.multipart.max-file-size=5MB` and accepts PNG/JPG/WEBP only, checked by **magic bytes** (not extension or client `Content-Type`).
- Stored with `JdbcClient` as `byte[]` → `bytea` (ADR-0004). Not JPA `@Lob`, which maps to `oid` on Postgres.
- `GET /api/images/{id}` returns the stored `Content-Type` with `X-Content-Type-Options: nosniff` and `Cache-Control: public, max-age=31536000, immutable`. Images are never changed, only replaced by a new ID.
- A card/profile stores either `image_id` or `image_url`. External URLs are kept as-is and must start with `https://` (mixed content; see `architecture/integrations.md`).
- `ImageStore` (Java interface): `UUID save(byte[] bytes, String contentType)`, `Optional<StoredImage> get(UUID id)`. A Cloudinary implementation is a future swap.

## Consequences
- **Simpler:** nothing to configure; uploads work the same for all 6 devs and on the deployed URL.
- **Harder:** DB size grows, so the Neon quota must be watched (R-T04). Image responses go through the JVM: slower than a CDN, fine at demo scale, but they count against the JVM heap if the upload limit isn't enforced (R-T11).
- **Postponed:** CDN, server-side resizing (e.g. Thumbnailator), deleting orphaned images.

## Related stories
US-22.1, US-25.1, US-25.2 (preview placeholder), US-08.2 (feed placeholder), US-16.
