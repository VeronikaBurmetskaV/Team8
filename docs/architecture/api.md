# FULLA — API Contract Sketch (MVP)

**Audience:** frontend and backend developers. This is the contract both sides code against.
**Sources:** endpoint list in ADR-0005, auth in ADR-0006, images in ADR-0007, consistency rules in ADR-0009, favourites in ADR-0012; error texts from the Gherkin scenarios of the stories.
**Status:** draft. Per ADR-0003 the living contract is `docs/contracts/api.md`; this file becomes it in week 1 (Q-02 in [`overview.md`](overview.md#9-open-questions)).
**Domain rules** behind each check: [`domain-model.md`](domain-model.md).

---

## 1. Conventions

- Base path `/api`, JSON in UTF-8, IDs are UUID strings, timestamps ISO-8601 UTC.
- **Session:** one cookie `FULLA_SESSION` (`HttpOnly`, `SameSite=Lax`, 30 days). The principal is a brand **or** a buyer, never both (ADR-0006).
- **CSRF:** every `POST`/`PUT` sends the header `X-XSRF-TOKEN` with the value of the `XSRF-TOKEN` cookie. Missing or wrong → `403 FORBIDDEN`.
- **Access levels** used in the table:
  - **Public** — no session needed.
  - **Brand** — session with `ROLE_BRAND`; data is filtered by the session's brand ID (INV-07).
  - **Buyer** — session with `ROLE_BUYER`.
- No session on a Brand/Buyer endpoint → `401 UNAUTHENTICATED`. Session of the other type → `403 FORBIDDEN`.
- A resource that does not exist **or belongs to another brand** → `404 NOT_FOUND` (Q-04).
- The backend is the authority on validation; the frontend repeats the rules only for instant feedback (ADR-0005).
- Price is an integer of UAH; the client formats it as `2400 грн` (US-08.2).
- Product URLs are returned exactly as the brand entered them (or, for imported cards, exactly as the source gave them). **The client** adds `utm_source=fulla` with `withUtm()` (ADR-0008).
- **Demo import (ADR-0014, Proposed, profile `dev` only):** the server fetches three configured sources and creates cards owned by account-less *source brands* (`data-model.md` §5). This adds **no endpoint**: there is no API to start, configure or view an import. Imported cards reach the client as `PublicCard`s; in `GET /api/feed` they also carry the optional details `sizes`, `colors`, `material`, `description` (`FeedCard`, §2.2). No other endpoint returns the details. Brand endpoints never return imported cards (they have no `brand_id`).

## 2. Endpoints

Endpoints marked ✚ are not in ADR-0005's list. They are proposed here, with the reason in the Open questions of `overview.md`.

### 2.1. Brand cabinet

| Method & path | Story | Access | Success | Errors |
|---|---|---|---|---|
| `POST /api/brand/register` | US-21 | Public | `201` brand session started; body `{ brandId, email, profileState: "ACTIVE" }` (the name is saved at registration) | 400 `PROFILE_INVALID` (`fields.name` / `fields.websiteUrl`), 400 `EMAIL_TAKEN_OR_INVALID` (format), 400 `PASSWORD_TOO_SHORT`, 409 `EMAIL_TAKEN_OR_INVALID` (taken), 429 |
| `POST /api/brand/login` | US-21.1 | Public | `200` `{ brandId, email, profileState }` | 401 `INVALID_CREDENTIALS`, 429 |
| `POST /api/brand/logout` | US-21.1 | Brand | `204` | 401 |
| `GET /api/brand/profile` | US-22.1, US-22.2, US-21.1 | Brand | `200` profile | 401, 403 |
| `PUT /api/brand/profile` | US-22.1, US-22.2 | Brand | `200` profile | 400 `PROFILE_INVALID`, 404 (foreign/unknown `logoImageId`), 409 `CONSENT_LOCKED`, 401, 403 |
| `GET /api/brand/products` | US-21.1 S1, US-25.1, US-31 | Brand | `200` list of own cards, newest first | 401, 403 |
| `POST /api/brand/products` | US-25.1, US-26 | Brand | `201` card with `status: "DRAFT"` | 400 `CARD_INVALID_NAME`, 400 `CARD_INVALID_PRICE_OR_PHOTO`, 400 `CARD_INVALID_URL`, 404 (foreign/unknown `photoImageId`), 409 `PROFILE_INCOMPLETE`, 401, 403 |
| ✚ `GET /api/brand/products/{id}` | US-25.2, US-26 | Brand | `200` card | 404, 401, 403 |
| `PUT /api/brand/products/{id}` | US-26 S1, US-25.1 | Brand | `200` card | 400 (same as create), 404, 409 `CARD_NOT_EDITABLE`, 401, 403 |
| `POST /api/brand/products/{id}/publish` | US-31, US-22.2 | Brand | `200` card with `status: "PUBLISHED"`, `publishedAt` | 404, 409 `CONSENT_REQUIRED`, 409 `PUBLISH_FIELDS_MISSING`, 409 `INVALID_STATE` (already published), 401, 403 |
| `POST /api/brand/products/{id}/unpublish` | US-31 | Brand | `200` card with `status: "DRAFT"` | 404, 409 `INVALID_STATE` (already draft), 401, 403 |
| `POST /api/images` | US-22.1, US-25.1 | **Brand** (Q-03; ADR-0006 currently implies Public) | `201` `{ id, url: "/api/images/{id}" }` | 400 `IMAGE_INVALID` (type by magic bytes, or > 5 MB), 401, 403 |

Shapes:
- **Register** request `{ name, websiteUrl, email, password }` (2026-11-26), fields in form order, so the top-level code is the first wrong one (§3.1). `name` has the profile rule (2–50 characters after trimming, no control characters); `websiteUrl` is **required**: lowercase `https://`, a domain host (`name.tld`, not `localhost` or an IP), ≤ 2048 characters, surrounding spaces trimmed. Both wrong → `400 PROFILE_INVALID` with `fields.name` / `fields.websiteUrl` (the same code as in the profile, no new codes). Name and website are written to the profile in the same transaction as the account (T-9), so the profile starts `ACTIVE` (domain-model.md §4.1). The server **never** requests the website (A-15): no reachability check.
- **Profile** request `{ name, websiteUrl | null, logoImageId | null, logoUrl | null, consentGiven }`; response adds `logoDisplayUrl`, `consentGivenAt`, `consentText`, `state: "INCOMPLETE" | "ACTIVE" | "CONSENTED"` and returns `websiteUrl`. In the profile `websiteUrl` is optional (same rule when given); PUT replaces it, so `null` or a missing field clears it. `consentGiven: true` from Active records consent; `false` after it was given → `CONSENT_LOCKED`.
- **Brand card** = `PublicCard` + `{ photoImageId, status: "DRAFT" | "PUBLISHED", publishedAt, createdAt }` (example in §4.1).
- `profileState` in login/register responses tells the SPA where to go: `INCOMPLETE` → `/brand/profile`, otherwise `/brand/products` (US-21 CL, US-21.1 CL).

### 2.2. Public catalogue

| Method & path | Story | Access | Success | Errors |
|---|---|---|---|---|
| `GET /api/feed` | US-01.2, US-08.1, US-08.2, US-09, US-10 | Public | `200` `{ items: FeedCard[] }`, only Published, brands and import sources mixed (see «Feed order» below); empty list is valid (US-08.1 CL) | 503 |
| `GET /api/products?ids=a,b,…` | US-16, US-19, US-32 | Public | `200` `{ items: PublicCard & { available } [] }`; unknown IDs omitted; unpublished cards included with `available: false` | 400 `VALIDATION_FAILED` (> 500 IDs or a non-UUID) |
| `GET /api/brands` | US-08.2, ADR-0015 | Public | `200` `BrandSummary[]` sorted by name: every brand (account brand or source brand) that has Published cards; brands whose names give the same key are one entry; empty list is valid | 503 |
| `GET /api/images/{id}` | US-08.2, US-16, US-22.1, US-25.2 | Public | `200` bytes, stored `Content-Type`, `nosniff`, `Cache-Control: immutable` | 404 (client shows the placeholder) |
| ✚ `GET /api/session` | US-16 CL, US-21.1 CL | Public | `200` `{ accountType: "BRAND" \| "BUYER" \| null, email \| null }`; sets `XSRF-TOKEN` | — |

**Feed order** (team lead decision for the demo, 17.11.2026; ADR-0014): imported cards are shown mixed across import sources and brands, not in blocks of one source. The server orders the Published cards round by round: each brand (account brand or source brand) gives its next card per round, its own cards in `publishedAt, id` order; inside a round the brands are ordered by a hash of the brand ID. The order is deterministic, so the client keeps showing the first card that is in neither `viewedIds` nor `favoriteIds`. The client does not reorder the list.

`PublicCard` = `{ id, name, brandName, priceUah, photoUrl, productUrl }`. `photoUrl` is either `/api/images/{id}` or the brand's `https://` URL (imported cards always use the source's `https://` URL; images are never copied, ADR-0014). `brandName` comes from the brand profile or, for imported cards, from the source brand. The brand logo is **never** included in a card (US-08.2 CL); since ADR-0015 it is served only by `GET /api/brands`, and only with the brand's consent.

`BrandSummary` = `{ key, name, logoUrl | null, productCount }` (ADR-0015). `key` is the catalogue's brand key (the same rules as `brandKey` on the client: apostrophes unified, NFKC, spaces collapsed, Ukrainian lower case); the client matches it with the brands of `GET /api/feed`. `productCount` counts Published cards. `logoUrl` is the profile's `logoDisplayUrl` (`/api/images/{id}` or the brand's `https://` URL) **only** for a brand in state `CONSENTED`, otherwise `null`. For an imported brand (ADR-0014) it is the `https://` logo URL found on the source site, only for a single-brand source and only in profile `dev` (`fulla.brands.source-logos`); `null` in every other profile. Logos are hot-linked, never copied. The client shows the monogram when `logoUrl` is `null` or the image fails to load.

`FeedCard` = `PublicCard` + optional `{ sizes, colors, material, description }`. Only imported cards (ADR-0014) have them; a key is **left out** when the card has no value (brand-made cards never have them), never sent as `null` or `[]`.

| Field | Type | Meaning |
|---|---|---|
| `sizes` | `[{ "label": string, "available": boolean }]` | Sizes in the source's order; `available: false` = out of stock |
| `colors` | `[{ "name": string, "hex": string \| null }]` | Colour name as the source gives it; `hex` is `#RRGGBB` from the importer's fixed table, `null` for an unknown name |
| `material` | string | Plain text, ≤ 500 chars, e.g. «Матеріал верху: Поліестер 95%, Еластан 5%» |
| `description` | string | Plain text (HTML removed on import), ≤ 5000 chars, lines separated by `\n` |

```json
{
  "items": [
    {
      "id": "6f1c…",
      "name": "Футболка сіра з принтом",
      "brandName": "Barricade",
      "priceUah": 750,
      "photoUrl": "https://media2.vsisvoi.ua/uploads/…/a.jpg",
      "productUrl": "https://vsisvoi.ua/store/futbolka-sira-p-211-316-0001",
      "sizes": [{ "label": "M", "available": true }, { "label": "L", "available": false }],
      "colors": [{ "name": "сірий", "hex": "#9E9E9E" }],
      "material": "100% Бавовна",
      "description": "Фасон: оверсайз\nКолір: сірий"
    },
    {
      "id": "0b7e…",
      "name": "Лляна сукня",
      "brandName": "Lileya",
      "priceUah": 2400,
      "photoUrl": "/api/images/1d2e…",
      "productUrl": "https://brand-site.ua/dress"
    }
  ]
}
```

### 2.3. Buyer account

| Method & path | Story | Access | Success | Errors |
|---|---|---|---|---|
| `POST /api/buyer/register` | US-02 | Public | `201` buyer session started; `{ email \| null, phone \| null, name }` | 400 `VALIDATION_FAILED` (`fields.name`: missing, blank or > 50), 400 `LOGIN_INVALID` (`fields.login`), 400 `PASSWORD_TOO_SHORT`, 409 `EMAIL_TAKEN_OR_INVALID` (email or phone taken, `fields.login`), 429 |
| `POST /api/buyer/login` | US-03 | Public | `200` `{ email }` | 401 `INVALID_CREDENTIALS`, 429 |
| `POST /api/buyer/logout` | US-03 | Buyer | `204` | 401 |
| `GET /api/me/favorites` | US-03, US-16 | Buyer | `200` `{ productIds: uuid[] }`, oldest like first | 401, 403 |
| `POST /api/me/favorites` | US-02, US-03, US-09 | Buyer | `200` `{ productIds, skippedIds }` = the full set after union (≤ 100) and the new IDs that did not fit | 400 `VALIDATION_FAILED` (> 500 IDs), 409 `FAVORITES_LIMIT_REACHED` (new IDs, none fitted), 401, 403 |

**Buyer register body (2026-11-27, ADR-0016; name required since 2026-11-28):** `{ name, login, password }`, in form order. `login` is «Email або номер телефону» as typed, one field: with «@» it is an email (strict email rule, trimmed, lower-cased), otherwise a phone — digits, spaces, brackets, hyphens and a leading «+»; Ukrainian `0XXXXXXXXX`, `380XXXXXXXXX`, `+380XXXXXXXXX` → `+380XXXXXXXXX`; other countries only with «+» and 8–15 digits; stored in E.164. Neither → `400 LOGIN_INVALID`. A taken email **or** phone → the same neutral `409 EMAIL_TAKEN_OR_INVALID` with `fields.login` (it never says which). `name` is **required**: 1–50 characters after trimming, not only spaces, no control characters; missing, blank or longer → `400 VALIDATION_FAILED` with `fields.name` (the name is the first field, so its code is the top-level one). The phone is not verified. The session principal carries the login, so `GET /api/session` returns the phone in `email` for a phone account.

`POST /api/me/favorites` is the **only** write for favourites: the same call does the merge after register/login (US-02 S1, US-03 S1), a single like (US-09) and a retry. It is idempotent; unknown product IDs are ignored (ADR-0012).

**Limits (2026-11-26, ADR-0012):** a registered buyer keeps at most **100** products, a guest at most **25** in the browser (the client checks it; nothing is stored on the server for guests). The server adds the IDs that are new (known products not saved yet) **in request order** until the buyer has 100; the new IDs that did not fit come back in `skippedIds` (unknown or already saved IDs are not "skipped", they are ignored). If there were new IDs but none fitted → `409 FAVORITES_LIMIT_REACHED` and nothing changes. Already saved IDs never hit the limit (a retry at 100 is `200`). The buyer's account row is locked for the write (`SELECT … FOR UPDATE`), so parallel writes cannot pass 100 together (ADR-0009).

---

## 3. Errors

### 3.1. Single error format

Every non-2xx response from `/api` has this body (ADR-0005), produced by one `@RestControllerAdvice`:

```json
{
  "error": {
    "code": "CARD_INVALID_URL",
    "message": "productUrl must start with http:// or https://",
    "fields": { "productUrl": "CARD_INVALID_URL" }
  }
}
```

| Field | Meaning |
|---|---|
| `code` | Stable machine code from §3.2. The frontend shows `messages.uk.ts[code]`. |
| `message` | English, for developers and logs only. **Never shown to users.** |
| `fields` | Optional. Map *request field → code*, so the form highlights the right input (US-22.1 S2 "підсвічує проблемне поле", US-25.1 S2 "біля некоректного поля"). |

Rules:
- **One request → one top-level `code`.** If several fields fail, `code` is the first in the order of the form; `fields` lists all of them.
- The frontend keeps all entered data on any 4xx (US-21 S2, US-02 S2, US-21.1 S2, US-03 S2).
- Login errors never say which field is wrong (US-21.1 CL, US-03 CL).

### 3.2. Error code dictionary

Ukrainian texts are copied from the stories and live **only** in `frontend/src/shared/messages.uk.ts`. "—" means no story gives a text yet (Q-08).

| HTTP | Code | When | UI text (uk) | Source |
|---|---|---|---|---|
| 400 | `VALIDATION_FAILED` | Malformed JSON, wrong types, > 500 IDs | — (generic) | ADR-0005, ADR-0012 |
| 400 | `EMAIL_TAKEN_OR_INVALID` | Email not `name@domain.tld` (e.g. no `@`) | «Цей email вже використовується або має некоректний формат» | US-21 S2, US-02 S2 |
| 409 | `EMAIL_TAKEN_OR_INVALID` | Email already registered for this account type (unique index, also under a race) | same text as above | US-21 S2, US-02 S2, ADR-0009 |
| 400 | `PASSWORD_TOO_SHORT` | Password < 8 (or > 72, Q-11) | — | US-21 CL, US-02 CL |
| 401 | `INVALID_CREDENTIALS` | Unknown email **or** wrong password (same answer) | «Невірний email або пароль» | US-21.1 S2, US-03 S2 |
| 401 | `UNAUTHENTICATED` | No session on a Brand/Buyer endpoint; client redirects to the right login page | — (redirect, no text) | US-21.1 CL, ADR-0008 |
| 403 | `FORBIDDEN` | Session of the other account type; missing/invalid CSRF token | — | ADR-0006 |
| 404 | `NOT_FOUND` | Unknown ID, another brand's card or image | — | INV-07, Q-04 |
| 400 | `PROFILE_INVALID` | Brand name empty or not 2–50; website not `https://` with a domain or > 2048 (`fields.websiteUrl`, register and profile); logo of an unsupported type; both upload and URL; logo URL not `https://` | «Вкажіть назву бренду та завантажте зображення у форматі JPG, PNG або WEBP» | US-22.1 S2 |
| 409 | `CONSENT_LOCKED` | Request sets `consentGiven: false` after consent was given | — (checkbox is disabled in the UI) | A-08 |
| 409 | `PROFILE_INCOMPLETE` | Card create/edit while the brand name is not saved | — (the «Додати товар» entry is hidden) | US-22.1 CL, US-25.1 CL |
| 400 | `IMAGE_INVALID` | Upload not PNG/JPG/WEBP by magic bytes, or > 5 MB | — (form-dependent, Q-08) | US-22.1 S2, US-25.1 CL, ADR-0007 |
| 400 | `CARD_INVALID_NAME` | Product name empty or > 100 | — | US-25.1 CL |
| 400 | `CARD_INVALID_PRICE_OR_PHOTO` | Price ≤ 0, not an integer, text, > upper bound; or no photo; photo URL not `https://` | «Вкажіть коректну ціну більше нуля та додайте фотографію товару» | US-25.1 S2 |
| 400 | `CARD_INVALID_URL` | Product URL empty, without `http://`/`https://`, or no host (e.g. «сукня») | «Введіть повне посилання на сторінку товару, що починається з https:// або http://» | US-26 S2 |
| 409 | `CARD_NOT_EDITABLE` | `PUT` on a Published card | — (edit is hidden while Published) | A-06 |
| 409 | `CONSENT_REQUIRED` | Publish while the brand has not given consent | «Для показу товарів на платформі необхідно підтвердити згоду на демонстрацію матеріалів бренду» | US-22.2 S2, US-31 S2 |
| 409 | `PUBLISH_FIELDS_MISSING` | Publish of a draft without name/photo/price/URL (defensive; drafts are complete by construction) | «Заповніть усі обов'язкові поля картки (назва, фото, ціна, посилання) перед публікацією» | US-31 CL, S2 note |
| 409 | `INVALID_STATE` | Publish a Published card, unpublish a Draft (e.g. a double click) | — (UI refetches the list) | ADR-0005, ADR-0009 |

Outside the 400–409 range, same envelope:

| HTTP | Code | When | Source |
|---|---|---|---|
| 400 | `LOGIN_INVALID` | Buyer registration: `login` is neither a valid email nor a valid phone number (ADR-0016) | «Введіть email або номер телефону у форматі +380…» | ADR-0016 |
| 409 | `FAVORITES_LIMIT_REACHED` | `POST /api/me/favorites`: the buyer already has 100 favourites and every new ID was refused | «Вподобане заповнене (100 з 100). Видаліть кілька товарів, щоб додати нові.» | ADR-0012 (limits) |
| 429 | `TOO_MANY_REQUESTS` | > ~10 login/register attempts per minute per IP | ADR-0006, Q-13 |
| 503 | `SERVICE_UNAVAILABLE` | DB unreachable; feed/«Вподобане» show retry, local favourites kept | `integrations.md` §4 |

Texts that the frontend shows **without** an API error (pure UI states), for completeness: «Ви переглянули всі доступні речі» (US-08.1), «У вас поки немає збережених речей» (US-16 S2), «Тимчасово недоступно на сайті бренду» (US-19 S2, `available: false`), «Зображення не завантажилося — перевірте файл або посилання на фото перед публікацією» (US-25.2 S2, image `onerror` in preview).

---

## 4. Examples (non-trivial endpoints only)

### 4.1. `POST /api/brand/products` — create a draft (US-25.1 S1, S2; US-26 S2)

Request:
```json
{
  "name": "Лляна сукня міді",
  "priceUah": 2400,
  "photoImageId": "6f1c2b0e-8a7d-4c1e-9b0a-2f4d5e6a7b8c",
  "photoUrl": null,
  "productUrl": "https://brand-site.ua/linen-dress"
}
```
Exactly one of `photoImageId` / `photoUrl` is set. The brand comes from the session, not the body.

`201 Created`:
```json
{
  "id": "0b9e7c52-1d3a-4f6e-8c2b-5a4d3e2f1a0b",
  "name": "Лляна сукня міді",
  "brandName": "Lileya",
  "priceUah": 2400,
  "photoUrl": "/api/images/6f1c2b0e-8a7d-4c1e-9b0a-2f4d5e6a7b8c",
  "productUrl": "https://brand-site.ua/linen-dress",
  "status": "DRAFT",
  "publishedAt": null,
  "createdAt": "2026-11-03T10:15:00Z"
}
```

`400 Bad Request` — price `-500` and URL «сукня» (US-25.1 S2 + US-26 S2 at once):
```json
{
  "error": {
    "code": "CARD_INVALID_PRICE_OR_PHOTO",
    "message": "priceUah must be > 0; productUrl must be an absolute http(s) URL",
    "fields": {
      "priceUah": "CARD_INVALID_PRICE_OR_PHOTO",
      "productUrl": "CARD_INVALID_URL"
    }
  }
}
```

### 4.2. `POST /api/brand/products/{id}/publish` — the publish gate (US-31 S1, S2; US-22.2 S2)

No request body. Implemented as one conditional `UPDATE` (ADR-0009, [`data-model.md`](data-model.md) §3).

`200 OK`:
```json
{
  "id": "0b9e7c52-1d3a-4f6e-8c2b-5a4d3e2f1a0b",
  "status": "PUBLISHED",
  "publishedAt": "2026-11-03T10:20:41Z",
  "...": "other card fields as in 4.1"
}
```

`409 Conflict` — the brand has not given consent:
```json
{
  "error": {
    "code": "CONSENT_REQUIRED",
    "message": "Brand consent is required before publishing"
  }
}
```
The card stays `DRAFT` and does not appear in `GET /api/feed`.

### 4.3. `POST /api/me/favorites` — merge on login (US-03 S1)

State before: the account holds A, B, C, D, E; the laptop's browser holds E, F (anonymous likes). Right after `POST /api/buyer/login` the client sends its local set:

Request:
```json
{ "productIds": ["<E>", "<F>"] }
```

`200 OK` — the server set after `INSERT … ON CONFLICT DO NOTHING`, oldest first:
```json
{ "productIds": ["<A>", "<B>", "<C>", "<D>", "<E>", "<F>"] }
```
The client **replaces** its local `favoriteIds` with this list: 6 items, E once, counter 6. Sending the same body again returns the same list (retry-safe). A single like while logged in is the same call with one ID.

### 4.4. `GET /api/products?ids=…` — «Вподобане» with an unpublished card (US-16, US-19 S2, ADR-0009)

`GET /api/products?ids=0b9e7c52-…,9a8b7c6d-…`

`200 OK`:
```json
{
  "items": [
    {
      "id": "0b9e7c52-1d3a-4f6e-8c2b-5a4d3e2f1a0b",
      "name": "Лляна сукня міді",
      "brandName": "Lileya",
      "priceUah": 2400,
      "photoUrl": "/api/images/6f1c2b0e-8a7d-4c1e-9b0a-2f4d5e6a7b8c",
      "productUrl": "https://brand-site.ua/linen-dress",
      "available": true
    },
    {
      "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
      "name": "Сорочка з вишивкою",
      "brandName": "Lileya",
      "priceUah": 3100,
      "photoUrl": "https://cdn.brand-site.ua/shirt.webp",
      "productUrl": "https://brand-site.ua/product?id=42",
      "available": false
    }
  ]
}
```
Card 1: the button opens `https://brand-site.ua/linen-dress?utm_source=fulla` in a new tab (US-32 S1). Card 2 is unpublished: the button is inactive with «Тимчасово недоступно на сайті бренду». Had it been available, the link would be `…/product?id=42&utm_source=fulla` (US-32 S2). Names, brand and price are **current** values, not the values at the time of the like (A-11).
