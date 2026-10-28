# FULLA — Requirements Digest (MVP)

**Sources:** [`docs/requirements.md`](../requirements.md) (journeys, story map, scope) and the 19 MVP stories in [`user stories/`](../../user%20stories/UserStoriesREADME.md).
**Revision 28.10.2026:** US-02 and US-03 (buyer registration/login with favourites transfer) moved to In Scope; US-21.1 (brand login/logout) added; gaps G-01, G-02, G-04…G-22 closed in the stories or ADRs (see §4 status column). The original analysis text below is kept and marked where it changed.
**Scope rule:** only stories marked **In Scope** are treated as requirements. Out-of-Scope stories (US-04…07, US-11…15, US-17, US-18, US-20, US-23, US-24, US-27…30) are cited only where they explain *why* something is absent.
**Conventions:**
- `US-xx S1/S2` = Scenario 1 (Happy Path) / Scenario 2 (Edge Case); `US-xx CL` = business-rule checklist.
- Requirement quotes are translated from Ukrainian. **UI strings are kept verbatim in Ukrainian** because they are literal requirements (button labels, messages).
- This document is analysis only: no design decisions, no technology choices.

---

## 0. Scope notes that affect analysis

The journeys in §1–2 of `requirements.md` describe more than the MVP. The following journey elements are **not** requirements and must not leak into design:

| Journey text | Why it is not a requirement |
|---|---|
| Buyer step 2: categories, size, brand selection | US-04…07 Out of Scope — "in MVP a shared catalog". |
| Buyer step 4: card "flips", composition, size chart, availability of S | US-13, US-14, US-15 Out of Scope — "in MVP basic data on the front side" (name, brand, price; US-08.2). |
| Buyer step 5: "compare prices and composition, delete unneeded items" | US-17, US-18 Out of Scope. Favorites are **append-only** in MVP. |
| Brand step 3: "composition, sizes XS–M with availability" | US-14 Out of Scope; card has no composition/size attributes. |
| Brand steps 2, 4, 5: site connection, auto-sync of stock/prices | Explicitly Post-MVP (note under Brand Journey). "In MVP the brand adds products manually … and updates availability and prices itself." |

**Buyer step 1 ("register via email so my preferences are saved") is a requirement since 28.10.2026** (US-02, US-03). Registration is **optional**: every buyer function works anonymously and the registration form is never shown before the feed. Anonymous favourites live in the browser and move into the account on registration or login. Previously: "US-02, US-03 Out of Scope — storage within the session is sufficient. Buyer is anonymous."

---

## 1. Entities and their states

### 1.1. Brand Account

The identity of a brand owner ("власниця бренду").

| Attribute | Constraint | Source |
|---|---|---|
| Work email | Required; format check; unique "in the database of registered brands" | US-21 CL, S2 |
| Password | Required; "minimum 8 characters" | US-21 CL, S1 |

**States**

| From | To | Initiator | Condition | Source |
|---|---|---|---|---|
| — (none) | **Registered** | Brand owner, "Зареєструвати бренд" | Valid, not-yet-registered email + password ≥ 8 chars | US-21 S1 |
| — | — (rejected) | Brand owner | Email already registered or lacks "@" → "Реєстрація блокується", entered data "не втрачаються" | US-21 S2 |

On success: "a brand cabinet is created, and the user is automatically redirected to the profile completion page" (US-21 CL). No other account state (verified / blocked / deleted) is mentioned.

> ~~There is **no login story** for brands (see Gap G-01).~~ Resolved: US-21.1 adds brand login and logout (no password reset in MVP).

### 1.2. Brand Profile

1:1 with Brand Account (implied by "a brand cabinet is created", US-21 CL).

| Attribute | Constraint | Source |
|---|---|---|
| Brand name | Required, 2–50 characters | US-22.1 CL |
| Logo | Upload PNG/JPG/WEBP **or** image URL; .pdf/.exe rejected. Mandatory status ambiguous (Gap G-04) | US-22.1 CL, S2 |
| Display consent | Checkbox, text: «Я надаю згоду платформі FULLA на демонстрацію логотипа, фотографій та інформації про товари мого бренду»; **unchecked by default** | US-22.2 CL |
| Consent status | "active consent" status is "recorded" | US-22.2 S1 |

**States** (derived — the requirements never name them as a state machine, but the gating rules define three meaningful stages):

| State | Meaning | Unlocks | Source |
|---|---|---|---|
| **Incomplete** | Registered, brand name not saved | Nothing: "Without a filled brand name, creating and publishing cards is unavailable" | US-22.1 CL |
| **Identified** | Brand name (and logo) saved | Creating cards: "opens access to adding products" | US-22.1 S1 |
| **Consented** ("active profile") | Consent checkbox saved as checked | Publishing cards: "unlocks the ability to publish product cards" | US-22.2 S1; US-25.1 S1 ("with an active profile") |

| From | To | Initiator | Condition | Source |
|---|---|---|---|---|
| Incomplete | Identified | Brand owner, «Зберегти профіль» | Name 2–50 chars, valid logo image | US-22.1 S1 |
| Incomplete/Identified | (unchanged) | Brand owner | Empty name or unsupported file → "Збереження скасовується", message «Вкажіть назву бренду та завантажте зображення у форматі JPG, PNG або WEBP» | US-22.1 S2 |
| Identified | Consented | Brand owner, ticks checkbox + «Зберегти профіль» | Name and logo already filled | US-22.2 S1 |
| Identified | (unchanged; publish blocked) | Brand owner tries "to complete profile activation or publish a product" | Checkbox unchecked → «Для показу товарів на платформі необхідно підтвердити згоду на демонстрацію матеріалів бренду» | US-22.2 S2 |
| Consented | ? (consent withdrawn) | — | **Not specified** (Gap G-08) | — |

Ambiguity: US-25.1 S1 requires "an active profile" for card *creation*, while US-22.1 S1 grants access to adding products after name+logo only. Whether "active" means Identified or Consented is unresolved (Gap G-05).

### 1.3. Product Card

Created manually by the brand (US-25.1); the only catalog content in MVP.

| Attribute | Constraint | Source |
|---|---|---|
| Product name | Required. Display: truncated with ellipsis beyond 2 lines | US-25.1 CL; US-08.2 CL |
| Price in UAH | Required; "positive number"; rejects negative, zero, text. Displayed as "XXXX грн" | US-25.1 CL, S2; US-08.2 CL |
| Photo | Required; "URL or file upload" | US-25.1 CL |
| Brand name | Not entered — "substituted automatically from the profile"; "automatically pulled into all product cards of this brand" | US-25.1 CL; US-22.1 CL |
| Product page URL on the brand site | Required in the card form; "accepts only valid addresses with http:// or https://" | US-26 CL |
| Status | «Чернетка» (Draft) / «Опубліковано» (Published) | US-25.1 CL; US-31 CL |
| Owner brand | Implied (cards appear "in the brand's product list") | US-25.1 S1 |

**States**

```
         save (valid)                publish (all required fields + consent)
  (new) ─────────────► Draft ─────────────────────────────────────► Published
                         ▲                                               │
                         └──────── unpublish ("at any moment") ──────────┘
```

| From | To | Initiator | Condition | Source |
|---|---|---|---|---|
| — | **Draft** | Brand owner, «Зберегти чернетку» | Name, price > 0, photo present (US-25.1 S2) **and** valid URL (US-26 CL: "Saving … without a valid link is impossible") | US-25.1 CL, S1; US-26 CL, S2 |
| — | (not saved) | Brand owner | Invalid price / missing photo → «Вкажіть коректну ціну більше нуля та додайте фотографію товару»; invalid URL → «Введіть повне посилання на сторінку товару, що починається з https:// або http://» | US-25.1 S2; US-26 S2 |
| Draft | Draft | Brand owner, «Попередній перегляд» | Preview "does not change the status of the card" | US-25.2 CL |
| Draft | **Published** | Brand owner, «Опублікувати у стрічку» | "filled mandatory fields (name, photo, price, valid URL)" **and** "confirmed consent in the profile" | US-31 CL, S1 |
| Draft | (blocked) | Brand owner | Missing URL or price → button blocked, «Заповніть усі обов'язкові поля картки (назва, фото, ціна, посилання) перед публікацією»; no consent → US-22.2 S2 message | US-31 S2; US-22.2 S2 |
| Published | **Draft** | Brand owner | "at any moment … if the item is sold out" | US-31 CL |

Effects: Published → "immediately becomes available in the swipe-feed catalog" (US-31 CL); Draft → "does not get into the buyers' feed" (US-25.1 CL).

Not specified: editing a Published card, deleting a card, any status other than these two (Gaps G-06, G-07). Note the contradiction between "cannot save without URL/price" and US-31 S2 "a draft in which the direct link or price is not specified" (Gap G-02).

### 1.4. Catalog / Swipe Feed

The set of Published cards shown to buyers.

| Attribute | Constraint | Source |
|---|---|---|
| Content | All Published cards — "in MVP a shared catalog"; "pre-formed catalog" | scope table US-04, US-06 |
| Order | Deterministic within a session (S2 refers to "the 6th card of the catalog") but ordering rule not given | US-01.2 S2 |

Feed screen states (per buyer session):

| State | Condition | What is shown | Source |
|---|---|---|---|
| **Card active** | "There are unviewed products in the current session" | "exactly one current product card with a large photo" + «Пропустити» and «Подобається» | US-08.1 CL, S1 |
| **Transitioning** | Between cards | Repeated presses on the same card are blocked | US-10 CL, S2 |
| **Catalog exhausted** | Last card liked or skipped | «Ви переглянули всі доступні речі» + active button to «Вподобане» | US-08.1 CL, S2 |
| **Catalog empty** (0 published cards) | — | **Not specified** (Gap G-10) | — |

### 1.5. Buyer Session (anonymous by default)

A buyer needs no account. Without one, all buyer state lives in "the storage of the current browser session" (US-09 CL). A buyer may register or log in (US-02, US-03); then favourites are also kept in the Buyer Account (§1.9), while viewing progress stays in the browser.

| Attribute | Evidence | Source |
|---|---|---|
| Viewing progress (which cards are viewed / position of the "current unviewed card") | "opens the feed on the current unviewed card"; "6th card … preserving previous viewing progress" | US-01.2 CL, S2 |
| Favorites list | "saved to the «Вподобане» list of the current session" | US-09 S1 |
| Favorites counter | "the counter next to the «Вподобане» icon increases by 1" | US-09 S1 |

Lifecycle: **New** (not viewed anything — US-01.2 S1) → **Active** (has progress/favorites) → survives page reload (US-09 S2) and return to the start page (US-01.2 S2). End of session (tab close, timeout) — **not specified** (Gap G-09).

### 1.6. Card Impression (per buyer session × product)

The status of a given card for a given buyer session.

| From | To | Initiator | Condition | Source |
|---|---|---|---|---|
| Unviewed | **Liked** (viewed + in Favorites) | Buyer: swipe right or «Подобається» | Card is current; not already in Favorites (no duplicates) | US-09 CL, S1 |
| Unviewed | **Skipped** (viewed, not in Favorites) | Buyer: swipe left or «Пропустити» | Card is current; second press within < 200 ms ignored | US-10 CL, S1, S2 |

Both transitions advance the feed to the next card (US-09 CL, US-10 S1). No transition back (US-12 "return to previous card" Out of Scope; US-17 remove from Favorites Out of Scope) — both terminal in MVP.

### 1.7. Favorite Item

Entry in the session's Favorites list.

| Attribute | Constraint | Source |
|---|---|---|
| Photo, name, brand, price | Displayed on each saved card | US-16 CL, S1 |
| «Перейти на сайт бренду» button | Active if the URL is valid; otherwise inactive with «Тимчасово недоступно на сайті бренду» | US-19 CL, S2 |

Whether it is a live reference to the Product Card or a snapshot is not specified (Gap G-11). No removal (US-17 Out of Scope).

### 1.8. Outbound Redirect (derived)

The transition from FULLA to the brand's product page. Not a stored entity in the requirements — only a behaviour with rules.

| Attribute | Rule | Source |
|---|---|---|
| Target | "the URL from the card (US-26)", "the direct page of this product" | US-32 CL; US-19 CL |
| Source tag | `utm_source=fulla` appended automatically | US-19 CL; US-32 CL |
| Query merge | Existing query → append with `&` (`https://brand-site.ua/product?id=42&utm_source=fulla`) | US-32 S2 |
| Opening mode | New browser tab; FULLA tab stays open | US-19 CL, S1 |

No click counting / reporting to the brand is required — the brand "sees on their side" via UTM (US-32 CL).

### 1.9. Buyer Account (optional, added 28.10.2026)

| Attribute | Constraint | Source |
|---|---|---|
| Email | Required; format `name@domain.tld`; unique among buyers | US-02 CL |
| Password | Required; minimum 8 characters | US-02 CL |
| Favourites | Set of product IDs; each product at most once | US-02 CL; US-03 CL |

| From | To | Initiator | Condition / effect | Source |
|---|---|---|---|---|
| Anonymous | **Logged in** | Buyer, «Зареєструватися» | Valid, unused email + password ≥ 8; browser favourites move into the account | US-02 S1 |
| Anonymous | (rejected) | Buyer | Email taken or malformed → «Цей email вже використовується або має некоректний формат»; browser favourites unchanged | US-02 S2 |
| Anonymous | **Logged in** | Buyer, «Увійти» | Correct credentials; browser ∪ account favourites, each once | US-03 S1 |
| Anonymous | (rejected) | Buyer | Wrong credentials → «Невірний email або пароль»; browser favourites unchanged | US-03 S2 |
| Logged in | Anonymous | Buyer, «Вийти» | Session ends; favourites and progress cleared on this device | US-03 CL |

---

## 2. Business rules / invariants

### 2.1. Buyer side

| ID | Rule | Source |
|---|---|---|
| BR-01 | Start page opens at the root address "without requiring login or registration". | US-01.1 CL, S1 |
| BR-02 | Start page shows «FULLA», a value-proposition headline, and the 3-step mechanic "Гортай картки — Зберігай у «Вподобане» — Купуй на сайті бренду". | US-01.1 CL, S1 |
| BR-03 | «Почати шопінг» opens the swipe feed "immediately … without intermediate registration forms or settings". | US-01.2 CL, S1 |
| BR-04 | Returning to the start page and pressing «Почати шопінг» again resumes at the current unviewed card; progress and Favorites are preserved (5 viewed → 6th shown). | US-01.2 CL, S2 |
| BR-05 | Exactly one current card is shown in the active feed zone at any time. | US-08.1 CL, S1 |
| BR-06 | Image is scaled proportionally "without geometric distortion". | US-08.1 CL |
| BR-07 | After the last card is liked or skipped, show «Ви переглянули всі доступні речі» + active button to «Вподобане»; never an empty screen. | US-08.1 CL, S2 |
| BR-08 | Card front always shows 3 text fields: product name, Ukrainian brand name, price in UAH "XXXX грн"; no flipping required. | US-08.2 CL, S1 |
| BR-09 | Names longer than 2 lines are truncated with an ellipsis "without breaking the layout and overlapping buttons". | US-08.2 CL |
| BR-10 | On image load failure (unavailable / 404), show a placeholder; name, brand, price and action buttons "work normally". | US-08.2 CL, S2 |
| BR-11 | Like = swipe right **or** «Подобається»; Skip = swipe left **or** «Пропустити». Both input modes are equivalent. | US-09 CL; US-10 CL |
| BR-12 | Favorites contain no duplicates. | US-09 CL |
| BR-13 | Liking increments the Favorites counter by 1 and shows the next card. | US-09 S1 |
| BR-14 | Favorites and viewing progress survive a page reload ("without loss of session data"); after reload the feed shows the next unviewed card. | US-09 S2 |
| BR-15 | A skipped item does not enter Favorites and is marked as viewed in the current session. | US-10 CL, S1 |
| BR-16 | During card change, repeated presses on the same card are blocked: two «Пропустити» presses < 200 ms apart count as one skip (card #5 skipped, #6 shown, not skipped). | US-10 CL, S2 |
| BR-17 | «Вподобане» is reachable from the navigation bar "from any screen of the platform". | US-16 CL, S1 |
| BR-18 | Each Favorites card shows photo, name, brand, price and «Перейти на сайт бренду». | US-16 CL, S1 |
| BR-19 | Empty Favorites shows «У вас поки немає збережених речей» and «Перейти до стрічки товарів». | US-16 CL, S2 |
| BR-20 | «Перейти на сайт бренду» opens the product's direct page in a **new tab**; the FULLA tab remains open. | US-19 CL, S1 |
| BR-21 | If the URL is empty or does not start with `http://`/`https://`, the button is inactive with «Тимчасово недоступно на сайті бренду». | US-19 CL, S2 |
| BR-22 | `utm_source=fulla` is appended to every outbound link; if a query string exists, it is appended with `&` without breaking the original address. | US-19 CL; US-32 CL, S1, S2 |
| BR-23 | The redirect is direct — no FULLA payment/cart page in between; FULLA does not request payment details, delivery address or size. | US-32 CL |

### 2.2. Brand side

| ID | Rule | Source |
|---|---|---|
| BR-30 | Registration requires work email + password (min 8 chars). | US-21 CL, S1 |
| BR-31 | Email format is checked (at least: rejects a string without "@") and must be unique among registered brands. | US-21 CL, S2 |
| BR-32 | On registration failure: blocked, single combined message «Цей email вже використовується або має некоректний формат» under the email field, entered data retained. | US-21 S2 |
| BR-33 | Successful registration creates the brand cabinet and redirects to profile setup. | US-21 CL, S1 |
| BR-34 | Brand name is mandatory, 2–50 characters. | US-22.1 CL |
| BR-35 | Logo accepted as PNG/JPG/WEBP upload or image URL; other formats (.pdf, .exe) rejected with «Вкажіть назву бренду та завантажте зображення у форматі JPG, PNG або WEBP», field highlighted, save cancelled. | US-22.1 CL, S2 |
| BR-36 | After profile save, logo and name are shown in the cabinet header. | US-22.1 S1 |
| BR-37 | Saved brand name is automatically reflected in **all** of the brand's cards. | US-22.1 CL; US-25.1 CL |
| BR-38 | Without a brand name, card creation and publication are unavailable. | US-22.1 CL |
| BR-39 | Consent checkbox is mandatory for publishing, unchecked by default, requires an explicit user action. | US-22.2 CL |
| BR-40 | **While consent is not confirmed, no product of the brand can be published to the buyer feed.** | US-22.2 CL, S2; US-31 CL |
| BR-41 | Card form requires name, price in UAH (positive number), photo (URL or upload). Negative, zero or text price, or missing photo → not saved, «Вкажіть коректну ціну більше нуля та додайте фотографію товару». | US-25.1 CL, S2 |
| BR-42 | Card form requires a product URL starting with `http://` or `https://`; otherwise save blocked, «Перевірити посилання» disabled, «Введіть повне посилання на сторінку товару, що починається з https:// або http://». | US-26 CL, S2 |
| BR-43 | «Перевірити посилання» opens the entered URL in a new tab (after format validation). | US-26 CL, S1 |
| BR-44 | A new card is saved as «Чернетка» and does not reach the buyer feed "before check and publication". | US-25.1 CL, S1 |
| BR-45 | Every card in the cabinet has «Попередній перегляд»; preview uses "the same template and proportions" as the buyer feed (large photo, name, brand, price in UAH) and includes a test link button. | US-25.2 CL, S1 |
| BR-46 | Preview does not change card status and allows returning to editing "in one click". | US-25.2 CL |
| BR-47 | Preview with a broken image shows a placeholder with «Зображення не завантажилося — перевірте файл або посилання на фото перед публікацією». | US-25.2 S2 |
| BR-48 | «Опублікувати у стрічку» is active only if name, photo, price, valid URL are filled **and** consent is confirmed; otherwise blocked with «Заповніть усі обов'язкові поля картки (назва, фото, ціна, посилання) перед публікацією». | US-31 CL, S2 |
| BR-49 | Publishing sets status Draft → Published and the card "immediately becomes available" in the feed. | US-31 CL, S1 |
| BR-50 | The brand may unpublish (Published → Draft) "at any moment". | US-31 CL |

### 2.3. Cross-cutting invariants

| ID | Invariant | Derived from |
|---|---|---|
| INV-01 | The buyer feed contains **only** cards with status Published. | US-25.1 CL; US-31 CL, S1 |
| INV-02 | Every Published card has: name, price > 0, photo, http(s) URL, owning brand with name set and consent confirmed. | US-22.1 CL; US-22.2 CL; US-31 CL |
| INV-03 | The brand name shown on a card always equals the current brand profile name. | US-22.1 CL ("automatically pulled into all cards") |
| INV-04 | A product appears in a session's Favorites at most once. | US-09 CL |
| INV-05 | Within a session, each card is acted on (liked/skipped) at most once; Liked ⊂ Viewed; Skipped ∩ Favorites = ∅. | US-09, US-10 CL |
| INV-06 | FULLA never processes orders, payments, delivery or sizes. | US-32 CL; journey step 6 |
| INV-07 | A brand may only see and change its own profile and cards. | **Implicit** — "the brand's product list" (US-25.1 S1), "в кабінеті бренду" throughout |

---

## 3. Non-functional requirements (explicit and implied)

| ID | NFR | Basis |
|---|---|---|
| NFR-01 | **Anonymous buyer access.** All buyer functions (start page, feed, like/skip, Favorites, redirect) work without authentication; registration is optional and never precedes the feed. | US-01.1 CL; US-01.2 CL; US-02 CL |
| NFR-02 | **Authenticated brand access.** The cabinet (profile, cards, publishing) must be accessible only to the owning brand. Implied by "account", "password", "cabinet"; not specified anywhere. | US-21; INV-07 |
| NFR-03 | **Credential security.** Passwords must not be stored or transmitted in recoverable form; registration and login traffic must be protected. Implied by email+password (US-21) and the Out-of-Scope reason for US-02: "requires … secure data storage". | US-21; scope table US-02 |
| NFR-04 | **Uniqueness under concurrency.** Email uniqueness (BR-31) must hold if two registrations with the same email arrive simultaneously — a check-then-insert is insufficient. | US-21 CL |
| NFR-05 | **Client-side persistence of buyer state.** Favorites and progress survive reload and navigation (BR-04, BR-14) with no server-side buyer identity for anonymous buyers. For registered buyers, favourites are also stored in the account and survive device changes. | US-09 CL, S2; US-01.2 S2; US-02, US-03 |
| NFR-06 | **Input debouncing / idempotency.** Card actions must be idempotent per card: < 200 ms double-press counts once; a like can never create a duplicate. | US-10 S2; US-09 CL |
| NFR-07 | **Publish-to-feed latency.** "immediately becomes available" — newly published cards must be visible to buyers without manual steps or a batch window. Same must reasonably apply to unpublishing (sold-out items). | US-31 CL |
| NFR-08 | **Responsive layout.** Mobile from 320 px width and desktop; no horizontal scroll, no overlapping text. Explicit for the start page; the journey ("I open the site from my phone") implies it for the whole buyer flow. | US-01.1 CL, S2; Buyer Journey step 1 |
| NFR-09 | **Touch gestures + button parity.** Swipe gestures for touch, buttons for every action (accessibility and desktop). | US-09 CL; US-10 CL |
| NFR-10 | **Resilience to third-party image failure.** Photos may be external URLs; feed, Favorites and preview must degrade to a placeholder without blocking actions. | US-08.2 S2; US-25.2 S2 |
| NFR-11 | **Safe outbound links.** Brand-supplied URLs are rendered to anonymous buyers and opened in new tabs: only `http`/`https` schemes are allowed (blocks `javascript:`, `data:`); the new tab must not be able to control the FULLA tab. | US-19 CL, S2; US-26 CL |
| NFR-12 | **Safe file uploads.** Logo and photo uploads must be restricted by type (PNG/JPG/WEBP explicitly for logo; .exe explicitly rejected) and — implicitly — by size, and must be served as images only. | US-22.1 CL, S2; US-25.1 CL |
| NFR-13 | **Untrusted brand content.** Brand name, product name and URLs are user-generated content displayed publicly; must be rendered safely (no markup injection). | US-22.1, US-25.1 |
| NFR-14 | **Consent auditability.** "The system records the status of active consent" — a legal permission to display brand materials; it should be attributable (who, when, which text). | US-22.2 S1 |
| NFR-15 | **Correct URL composition.** UTM must be appended without breaking existing query parameters (and implicitly fragments). | US-32 S2 |
| NFR-16 | **Localization.** UI in Ukrainian; prices in UAH with "грн". | All UI strings; US-08.2 CL |
| NFR-17 | **Preview fidelity.** Brand preview must use the same rendering as the buyer feed ("the same template and proportions"), so the two must not drift. | US-25.2 CL |
| NFR-18 | **Demo-scale capacity.** MVP is "an end-to-end set that the team implements and demonstrates"; catalog is manually curated ("in MVP different brands are added manually", US-11 note). No load, availability or performance targets are stated. | requirements.md §3 |
| NFR-19 | **Data minimisation for buyers.** Anonymous buyers: no personal data is collected. Registered buyers: only email, a non-recoverable password hash and the liked product IDs; never payment, address or size. The registration form states what is stored. | US-32 CL; US-02 CL |

---

## 4. Gaps and open questions

Ordered by how strongly they block design. "Cheapest MVP answer" = the answer that needs the least new scope while keeping the stories consistent.

**Status (28.10.2026):**

| Gap | Status | Where |
|---|---|---|
| G-01 | Resolved | US-21.1; ADR-0006 |
| G-02 | Resolved | US-25.1 CL (URL required), US-31 S2 rewritten |
| G-03 | **Accepted risk** | `architecture/risks.md` R-P03 |
| G-04, G-05 | Resolved: logo optional; active profile = brand name set | US-22.1 CL, US-22.2, US-25.1 CL/S1 |
| G-06 | Resolved: published cards read-only | ADR-0009 (A-06) |
| G-07 | Resolved: no deletion, only unpublish | US-31 CL |
| G-08 | Resolved: consent locked in UI, operator can withdraw | ADR / risks R-P10 (A-08) |
| G-09 | Resolved | A-09 (revised), US-02, US-03; ADR-0008, ADR-0012 |
| G-10 | Resolved: empty catalog = "all viewed" state | US-08.1 CL |
| G-11, G-12 | Resolved | ADR-0009 |
| G-13 | Resolved: PNG/JPG/WEBP ≤ 5 MB, `https://` image URLs | US-22.1 CL, US-25.1 CL; ADR-0007 |
| G-14 | Resolved: display "2400 грн" | US-08.2 CL; journeys in `requirements.md` |
| G-15 | Resolved: product name 1–100 chars | US-25.1 CL |
| G-16 | Resolved: `name@domain.tld` format | US-02 CL, US-21 CL |
| G-17, G-18 | Resolved | ADR-0009; `architecture/integrations.md` |
| G-19 | Resolved: buyer cards show brand name only | US-08.2 CL, US-22.1 CL |
| G-20 | Resolved: «Вподобане» + buyer login on all buyer screens, not in the cabinet | US-16 CL |
| G-21 | Resolved: login/logout only; no email/password change or deletion | US-21.1; ADR-0006 |
| G-22 | Resolved: one account = one brand; buyer and brand accounts separate | ADR-0006 (A-03) |
| G-23 | **Accepted risk** | `architecture/risks.md` (A-19) |

| ID | Gap | Why it blocks | Cheapest MVP answer |
|---|---|---|---|
| **G-01** | **No brand login / logout / session story.** US-21 only covers registration and an immediate redirect. | Without login, a brand that closes the browser can never return to its cabinet to publish (US-31) or unpublish sold-out items ("at any moment", US-31 CL). The brand journey is not end-to-end. Also defines what NFR-02 protects. | Add minimal email + password login and logout to the cabinet. No password reset, no email verification (operator resets manually). |
| **G-02** | **Contradiction: when are required fields validated?** US-25.1 and US-26 block *saving* a draft without price/photo/URL, but US-31 S2 assumes "a draft in which the direct link or price is not specified" exists. US-25.1 CL also does not list the URL among required fields, while US-26 does. | Determines whether Draft can be incomplete, i.e. the validation model and the meaning of the Draft state. | Validate everything at save (US-25.1 + US-26); a saved Draft is always complete. Keep the US-31 publish guard as a defensive re-check (it then fires only for consent). Rewrite US-31 S2 accordingly. |
| **G-03** | **Who operates the platform?** No admin/moderator role, no moderation of brands or cards, no check that a brand is "Ukrainian" or genuine. | Anyone can register and publish to an anonymous public feed (impersonation, inappropriate photos). Determines roles and whether a review state exists between Draft and Published. | No admin UI and no moderation in MVP; the team acts on stored data directly if needed. Record as accepted risk. |
| **G-04** | **Is the logo mandatory?** US-22.1 CL marks only the name as mandatory, but the S2 error text demands an image, and US-22.2 S1/S2 preconditions assume the logo is filled. | Defines profile completeness and whether the gate to Consented depends on the logo. | Logo optional; only name gates card creation (literal reading of US-22.1 CL). |
| **G-05** | **What is an "active profile"?** US-25.1 S1 requires it for creating a card; US-22.1 S1 grants card creation after name+logo; US-22.2 gates only publishing. | Determines whether card creation is gated by consent. | Name set ⇒ may create drafts; consent ⇒ may publish (US-22.1 CL + US-22.2 CL). "Active profile" = name set. |
| **G-06** | **Editing cards.** Can a Published card be edited? Does editing return it to Draft? Can a Draft be edited (US-26 S1 says "edits the card", so yes)? | Defines transitions on Published and whether buyers can see an unpreviewed change; affects price updates, which the brand must do manually ("updates … prices itself"). | Draft: editable. Published: not editable; to change, unpublish → edit → publish (uses existing US-31 transitions only). |
| **G-07** | **Deleting cards.** Not mentioned. | Lifecycle completeness; what happens to Favorites referencing a deleted card. | No deletion in MVP; unpublishing is the only removal. |
| **G-08** | **Withdrawing consent.** Can the brand uncheck consent? What happens to already Published cards? | BR-40 says no product may be published without consent — withdrawing must either be forbidden or unpublish everything, otherwise INV-02 breaks. | Consent cannot be withdrawn in the MVP UI (checkbox locked once saved). |
| **G-09** | **Definition of a buyer "session".** It must survive reload (US-09 S2) and return to the start page (US-01.2 S2). Unspecified: tab close, browser restart, multiple tabs, time limit. | Defines where buyer state lives and how long; affects whether a buyer who closes the tab loses Favorites (and hence US-19). | Session = this browser on this device, until the user clears site data; shared between tabs. No expiry. (Exact mechanism is a design decision.) |
| **G-10** | **Empty catalog.** Behaviour when zero cards are published (first launch, all unpublished) is not specified; US-08.1 S2 only covers "after the last card". | First-time demo and any brand-side unpublishing can produce it. | Reuse the exhausted state «Ви переглянули всі доступні речі» + button to «Вподобане». |
| **G-11** | **Catalog changes during a buyer session.** A card is published/unpublished/renamed while a buyer is mid-feed or has it in Favorites. Is a Favorite a live reference or a snapshot? | Affects INV-03 (brand name auto-updated), sold-out handling (US-31 "if the item is sold out"), and the only case in which US-19 S2's "inactive button" can actually occur (URLs are validated on save). | Favorites store a reference; feed and Favorites show current data. Unpublished items in Favorites stay visible with the inactive button «Тимчасово недоступно на сайті бренду» (gives US-19 S2 a real trigger). Newly published cards are appended to the end of the remaining feed. |
| **G-12** | **Feed order.** "the 6th card of the catalog" implies a deterministic order, but no rule is given. "Different brands" should appear (journey step 3), yet US-11 distribution rules are Out of Scope. | Needed for progress tracking and for reproducible acceptance tests (US-01.2 S2, US-10 S1 "card #5 → #6"). | Fixed global order by publication time (oldest first or newest first — pick one), identical for all buyers. No shuffling or brand interleaving. |
| **G-13** | **Image constraints.** No max file size, dimensions, aspect ratio, or formats for product photos (logo formats only). URL images are hot-linked from third parties. | Upload limits are needed for NFR-12; aspect ratio affects "large photo without distortion" (BR-06) and preview fidelity. | Same formats as the logo (PNG/JPG/WEBP), one size cap (e.g. 5 MB), any aspect ratio, displayed letterboxed/contained. |
| **G-14** | **Price format.** Integer or with kopecks? Upper bound? Display "XXXX грн" (US-08.2) vs "2 400 грн" with a thin space (journeys) vs "2400 грн" (US-25.2 S1). | Defines validation and the single display format used by feed, Favorites and preview. | Whole hryvnias only, positive integer, sane upper bound; display "2400 грн" as in US-25.2 S1 (the most specific scenario). |
| **G-15** | **Product name constraints.** Required, but no min/max length (unlike brand name 2–50). | Validation and BR-09 truncation behaviour. | 1–100 characters. |
| **G-16** | **Email validation depth.** Only "a string without @" is an example of invalid. | Defines what "format" means. | Basic syntactic check (something@something.tld); no deliverability check. |
| **G-17** | **UTM edge cases.** Not covered: URL with a fragment (`#size`), URL already containing `utm_source`. | Naïve appending after `#` silently drops the tag; duplicate `utm_source` may confuse brand analytics. | Insert before the fragment; if `utm_source` already present, leave the brand's URL unchanged (respect the brand). |
| **G-18** | **"Valid URL" = format only?** US-26 checks only the `http(s)://` prefix; reachability is verified manually via «Перевірити посилання». | Whether the system must fetch brand URLs (outbound requests, SSRF concerns). | Format-only validation; no server-side fetch. |
| **G-19** | **Brand logo on buyer side.** US-22.1 story says logo helps "buyers identify my brand on product cards", but US-08.2 / US-16 / US-25.2 list only brand *name*. | Whether the buyer card renders the logo. | Logo shown only in the cabinet header (US-22.1 S1); buyer cards show the name only. |
| **G-20** | **Navigation scope.** "from any screen of the platform" (US-16 CL) — includes the start page? The brand cabinet? | Layout of buyer navigation. | All buyer screens (start page, feed, Favorites); not the brand cabinet. |
| **G-21** | **Brand account lifecycle beyond registration.** Change email/password, delete account, edit the profile later (name change is implied by INV-03). | Account management surface. | Profile (name/logo) editable; nothing else in MVP. |
| **G-22** | **Several accounts per brand / several brands per account.** Not stated. | Data ownership model. | Exactly one account ⇔ one brand. |
| **G-23** | **Success measurement.** Brand journey step 6 promises new orders "from people who came from FULLA", but FULLA records nothing (no click logging required). | If the team must demonstrate traction, it needs at least outbound click counts. | None in MVP; rely on UTM in the brand's own analytics (US-32 CL). |

---

## 5. Proposed MVP assumptions

Risk = impact on the design if the assumption turns out to be wrong.

| ID | Assumption | Resolves | Risk if wrong | Why |
|---|---|---|---|---|
| A-01 | Brands get a minimal email+password login/logout; no password reset, no email verification. | G-01, G-21 | **High** | Without login the brand flow cannot be demoed beyond the first visit; if reset/verification are required, it adds email delivery as a new dependency. |
| A-02 | All card fields (name, price, photo, URL) are validated at save; a Draft is always complete; the publish gate effectively checks consent. | G-02 | Medium | If incomplete drafts are expected, the validation model and Draft semantics change, and the US-31 S2 message wiring changes. |
| A-03 | One account = one brand = one profile. | G-22 | Medium | Multi-user brands or agencies managing several brands change ownership and authorization. |
| A-04 | No admin role and no moderation; content goes live on the brand's own action. | G-03 | **High** | Public anonymous feed with unmoderated uploads is a reputational/legal exposure; adding a review step later inserts a new state between Draft and Published. |
| A-05 | Logo is optional; brand name alone unlocks card creation; consent unlocks publishing. | G-04, G-05 | Low | Only adds/removes a validation gate. |
| A-06 | Published cards are read-only; to edit, unpublish → edit → republish. | G-06 | Low | Brands may find it clumsy; allowing edits of Published later is additive. |
| A-07 | No card deletion; unpublish is the only removal. | G-07 | Low | Additive later; drafts may accumulate. |
| A-08 | Consent cannot be withdrawn in the UI once given. | G-08 | Medium | A legal requirement to withdraw (consent must be revocable) would force "withdraw ⇒ unpublish all" logic. |
| A-09 | Anonymous buyer session = this browser/device, shared across tabs, no expiry, survives reload and browser restart until site data is cleared. Registered buyer (US-02, US-03): favourites live in the account and are merged with the browser list on registration/login (each product once); viewing progress stays per device; logout clears favourites and progress on the device. | G-09 | Medium | A "per-tab" or "expires" interpretation changes where state is kept and the US-01.2/US-09 test expectations. |
| A-10 | Feed order is a single fixed global order by publication time; newly published cards are appended at the end of a buyer's remaining feed; no personalisation, shuffling or brand interleaving. | G-12, G-11 | Medium | If "discover different brands" (journey step 3) is a demo goal, a few brands with many cards will dominate; changing ordering later affects progress tracking. |
| A-11 | Favorites hold references; feed/Favorites always show current card data; unpublished favorites stay listed with the inactive «Тимчасово недоступно на сайті бренду» button. | G-11 | Medium | If snapshots are expected (buyer sees what they liked), data model changes; if unpublished items must disappear, US-19 S2 behaviour changes. |
| A-12 | Empty catalog shows the "all viewed" state. | G-10 | Low | Only UI text. |
| A-13 | Price is a positive whole number of UAH with an upper bound; displayed as "2400 грн". | G-14 | Low | Kopecks or thousands separators are formatting changes. |
| A-14 | Product name 1–100 chars; photos PNG/JPG/WEBP up to ~5 MB, any aspect ratio, shown without cropping distortion. | G-13, G-15 | Low | Limits are easy to tune. |
| A-15 | URL validation is format-only (`http://`/`https://` + well-formed); FULLA never fetches brand URLs server-side. | G-18 | Low | Automated reachability checks would be additive (and belong to Post-MVP integration, US-23). |
| A-16 | UTM is inserted before any `#fragment`; a URL that already has `utm_source` is left unchanged. | G-17 | Low | Pure string-handling rule. |
| A-17 | Consent is recorded with timestamp and the exact consent text shown. | NFR-14 | Low | Cheap to record now; impossible to reconstruct later. |
| A-18 | Buyer navigation to «Вподобане» exists on start page, feed and Favorites; brand logo is cabinet-only. | G-19, G-20 | Low | UI-only. |
| A-19 | No click tracking; attribution relies only on `utm_source=fulla`. | G-23 | Medium | If the demo must show "FULLA sent N buyers", an outbound-click record must be added to the redirect path. |
| A-20 | Demo-scale load (tens of brands, hundreds of cards, few concurrent users); no availability/performance SLA. | NFR-18 | Low | Real launch traffic would require revisiting, but nothing in MVP scope depends on scale. |

---

## 6. Traceability summary

| Story | Entities touched | Rules |
|---|---|---|
| US-01.1 | — (static) | BR-01, BR-02; NFR-01, NFR-08 |
| US-01.2 | Buyer Session | BR-03, BR-04 |
| US-02 | Buyer Account, Favorite Item | NFR-01, NFR-03, NFR-04, NFR-19; INV-04 |
| US-03 | Buyer Account, Favorite Item, Buyer Session | NFR-03, NFR-05; INV-04 |
| US-08.1 | Catalog/Feed, Card Impression | BR-05, BR-06, BR-07 |
| US-08.2 | Product Card (display) | BR-08, BR-09, BR-10 |
| US-09 | Card Impression, Favorite Item, Buyer Session | BR-11, BR-12, BR-13, BR-14; INV-04 |
| US-10 | Card Impression | BR-11, BR-15, BR-16; INV-05 |
| US-16 | Favorite Item | BR-17, BR-18, BR-19 |
| US-19 | Favorite Item, Outbound Redirect | BR-20, BR-21, BR-22 |
| US-21 | Brand Account | BR-30…BR-33; NFR-03, NFR-04 |
| US-21.1 | Brand Account | NFR-02, NFR-03; INV-07 |
| US-22.1 | Brand Profile | BR-34…BR-38; INV-03 |
| US-22.2 | Brand Profile (consent) | BR-39, BR-40; NFR-14 |
| US-25.1 | Product Card | BR-41, BR-44 |
| US-25.2 | Product Card (preview) | BR-45, BR-46, BR-47; NFR-17 |
| US-26 | Product Card (URL) | BR-42, BR-43 |
| US-31 | Product Card (status), Catalog | BR-48, BR-49, BR-50; INV-01, INV-02; NFR-07 |
| US-32 | Outbound Redirect | BR-22, BR-23; INV-06 |
