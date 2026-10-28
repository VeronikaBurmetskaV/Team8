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
- Product URLs are returned exactly as the brand entered them. **The client** adds `utm_source=fulla` with `withUtm()` (ADR-0008).

## 2. Endpoints

Endpoints marked ✚ are not in ADR-0005's list. They are proposed here, with the reason in the Open questions of `overview.md`.

### 2.1. Brand cabinet

| Method & path | Story | Access | Success | Errors |
|---|---|---|---|---|
| `POST /api/brand/register` | US-21 | Public | `201` brand session started; body `{ brandId, email, profileState: "INCOMPLETE" }` | 400 `EMAIL_TAKEN_OR_INVALID` (format), 400 `PASSWORD_TOO_SHORT`, 409 `EMAIL_TAKEN_OR_INVALID` (taken), 429 |
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
- **Profile** request `{ name, logoImageId | null, logoUrl | null, consentGiven }`; response adds `logoDisplayUrl`, `consentGivenAt`, `consentText`, `state: "INCOMPLETE" | "ACTIVE" | "CONSENTED"`. `consentGiven: true` from Active records consent; `false` after it was given → `CONSENT_LOCKED`.
- **Brand card** = `PublicCard` + `{ photoImageId, status: "DRAFT" | "PUBLISHED", publishedAt, createdAt }` (example in §4.1).
- `profileState` in login/register responses tells the SPA where to go: `INCOMPLETE` → `/brand/profile`, otherwise `/brand/products` (US-21 CL, US-21.1 CL).

### 2.2. Public catalogue

| Method & path | Story | Access | Success | Errors |
|---|---|---|---|---|
| `GET /api/feed` | US-01.2, US-08.1, US-08.2, US-09, US-10 | Public | `200` `{ items: PublicCard[] }`, only Published, ordered by `publishedAt, id`; empty list is valid (US-08.1 CL) | 503 |
| `GET /api/products?ids=a,b,…` | US-16, US-19, US-32 | Public | `200` `{ items: PublicCard & { available } [] }`; unknown IDs omitted; unpublished cards included with `available: false` | 400 `VALIDATION_FAILED` (> 500 IDs or a non-UUID) |
| `GET /api/images/{id}` | US-08.2, US-16, US-22.1, US-25.2 | Public | `200` bytes, stored `Content-Type`, `nosniff`, `Cache-Control: immutable` | 404 (client shows the placeholder) |
| ✚ `GET /api/session` | US-16 CL, US-21.1 CL | Public | `200` `{ accountType: "BRAND" \| "BUYER" \| null, email \| null }`; sets `XSRF-TOKEN` | — |

`PublicCard` = `{ id, name, brandName, priceUah, photoUrl, productUrl }`. `photoUrl` is either `/api/images/{id}` or the brand's `https://` URL. The brand logo is **never** included (US-08.2 CL).

### 2.3. Buyer account

| Method & path | Story | Access | Success | Errors |
|---|---|---|---|---|
| `POST /api/buyer/register` | US-02 | Public | `201` buyer session started; `{ email }` | 400 `EMAIL_TAKEN_OR_INVALID` (format), 400 `PASSWORD_TOO_SHORT`, 409 `EMAIL_TAKEN_OR_INVALID` (taken), 429 |
| `POST /api/buyer/login` | US-03 | Public | `200` `{ email }` | 401 `INVALID_CREDENTIALS`, 429 |
| `POST /api/buyer/logout` | US-03 | Buyer | `204` | 401 |
| `GET /api/me/favorites` | US-03, US-16 | Buyer | `200` `{ productIds: uuid[] }`, oldest like first | 401, 403 |
| `POST /api/me/favorites` | US-02, US-03, US-09 | Buyer | `200` `{ productIds }` = the full set after union | 400 `VALIDATION_FAILED` (> 500 IDs), 401, 403 |

`POST /api/me/favorites` is the **only** write for favourites: the same call does the merge after register/login (US-02 S1, US-03 S1), a single like (US-09) and a retry. It is idempotent; unknown product IDs are ignored (ADR-0012).

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
| 400 | `PROFILE_INVALID` | Brand name empty or not 2–50; logo of an unsupported type; both upload and URL; logo URL not `https://` | «Вкажіть назву бренду та завантажте зображення у форматі JPG, PNG або WEBP» | US-22.1 S2 |
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
