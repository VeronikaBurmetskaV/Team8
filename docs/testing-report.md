# Звіт про тестування FULLA (QA-аудит 6.3)

Дата: 26.11.2026, гілка `docs/testing-report` від `main` (`de1ded8`). Середовище: Windows 11, Temurin 21.0.13, Node 26.13, локаль ОС `Ukrainian_Ukraine.1251`. Стратегія: [`docs/testing-strategy.md`](testing-strategy.md). Промпт: [`prompts/6.3_qa_audit_and_debugging.md`](../prompts/6.3_qa_audit_and_debugging.md).

## 1. Покриття автотестами

### 1.1. Історії та сценарії

HP = Happy Path, EC = Edge Case. Шляхи бекенду від `backend/src/test/java/ua/fulla/`, фронтенду від `frontend/src/`.

| Історія / правило | HP | EC | Бекенд | Фронтенд |
| --- | --- | --- | --- | --- |
| US-21, US-21.1: реєстрація, вхід, вихід бренду | реєстрація = вхід, сесія `FULLA_SESSION` | гонка двох реєстрацій → `201` + `409`; невалідний email; ліміт спроб; вхід без підказки поля (`INVALID_CREDENTIALS`); атомарність акаунт + профіль (T-9) | `brandauth/BrandAuthTest`, `BrandAuthHttpTest`, `AttemptLimitTest`, `BrandRegistrationAtomicityTest` | `features/cabinet-auth/BrandRegisterPage.test.tsx`, `pathAfterLogin.test.ts` |
| US-22.1, US-22.2: профіль і згода | назва + сайт зберігаються; згода з текстом і часом | відкликання → `409 CONSENT_LOCKED`; лого → `400`; порушення `CHECK` → `400` на полі, не `500`; **українська локаль PostgreSQL** | `brandprofile/BrandProfileTest`, `ConstraintFieldTest` (новий) | `features/cabinet-profile/*.test.ts(x)` |
| US-25.1: створення чернетки | `201 DRAFT`, `brandName` з профілю, картки немає в `/api/feed` | ціна `-500`/`0`/текст/дробова/`> 1 000 000`; без фото; два джерела фото; чуже фото → `404`; без назви бренду → `409 PROFILE_INCOMPLETE`; кілька помилок → перша за порядком форми | `products/ProductTest`, `CreateCardAcceptanceTest` | `features/cabinet-products/cardForm.test.ts`, `cardForm.acceptance.test.ts` |
| US-26: посилання на товар, редагування | `http(s)` зберігається як введено; редагування чернетки (**новий тест**) | `сукня`, без схеми, `ftp://`, > 2048 → `CARD_INVALID_URL`; ті самі правила при редагуванні; чужа/невідома картка → `404` (**новий**) | `ProductTest`, `CreateCardAcceptanceTest`, `PublishTest#editingADraftHasTheCreateRulesAndOnlyTheOwnerMayEdit` | `shared/validation.test.ts` (спільні приклади з `ValidationExamples`) |
| US-31: публікація / зняття | публікація → `PUBLISHED`, у стрічці; зняття → `DRAFT`, зникає зі стрічки | без згоди → `409 CONSENT_REQUIRED`; повтор → `409 INVALID_STATE`; **дві паралельні публікації → рівно одна `200`** (новий); опублікована картка не редагується → `409 CARD_NOT_EDITABLE`, нова ціна через зняття (новий); чужа → `404`; покупець → `403`; без CSRF → `403`; republish → новий `published_at` | `products/PublishTest`, `PublishAcceptanceTest` | `features/cabinet-products/publishGate.test.ts`, `BrandProductsPage.test.tsx` |
| US-08.1, US-08.2: стрічка | лише Published, 6 публічних полів, порядок `published_at` | republish іде в кінець; бренди чергуються по раундах | `feed/FeedTest`, `BrandListTest` | `features/feed/queue.test.ts` |
| US-09, US-10: like / skip | like → `favoriteIds`, наступна картка; skip не чіпає «Вподобане» | подвійний skip пропускає лише одну картку; свайп + кнопка = одна дія; пропущена не повертається після refetch; ліміт 25 для гостя | — (лише браузер) | `features/feed/queue.test.ts`, `queue.acceptance.test.ts`, `keyboard.test.ts` |
| US-16, US-19, US-32: «Вподобане», перехід на сайт | `withUtm` додає `utm_source=fulla` перед `#` | наявний `utm_source`; `null`/`undefined`/`""`/`http:` → без посилання | `buyer/FavoritesTest` (об'єднання, повтор, ліміт) | `shared/links.test.ts`, `shared/SavedProducts/SavedProducts.test.tsx`, `favoritesLimit.test.tsx` |
| US-02, US-03: покупець, ролі | реєстрація = вхід `BUYER`; той самий email може бути брендом і покупцем | гонка → `409`; покупець на `/api/brand/**` → `403`; бренд на `/api/me/**` → `403`; без CSRF → `403` | `buyer/BuyerRegisterTest`, `FavoritesTest` | `features/buyer-auth/*.test.ts(x)` |
| Імпорт каталогу (ADR-0014, ADR-0017) | демо- і бренд-імпорт створює чернетки, повторний імпорт без дублів | robots.txt; приватні адреси, редиректи, `http`, чужий домен; ліміт запитів; неповний прогін нічого не ховає; «Немає на сайті» не публікується; ручні правки зберігаються; дві паралельні заявки → один прогін; мережа в тестах не викликається | `catalogimport/*Test` (15 класів, фікстури + `FakeWeb`) | `features/cabinet-import/*.test.ts(x)` |
| Зображення (ADR-0007) | PNG/JPG/WEBP за magic bytes, кеш `immutable` | SVG, > 5 МБ, підміна розширення | `images/ImageTest`, `ImageServiceTest`, `ImageUploadHttpTest` | — |

**Моки.** БД не мокається ніде. Єдиний Mockito-об'єкт у бекенді — `@MockitoSpyBean` у `BrandRegistrationAtomicityTest`: кидає виняток після вставки акаунта, щоб перевірити відкат T-9 на справжньому Postgres. Мережу імпорту замінює `catalogimport/FakeWeb` на локальних фікстурах. У фронтенді `vi.mock` підміняє лише `shared/reveal` (анімація через IntersectionObserver) і `shared/productLists`. Фейкових заглушок, що завжди зелені, не знайдено.

### 1.2. Перевірка «зламай код» для нових тестів

Кожну поломку вносили окремо, запускали один тест і відкочували через `git checkout`.

| Поломка | Тест | Результат |
| --- | --- | --- |
| `ProductRepository.updateDraft`: прибрати `AND p.status = 'draft'` | `PublishTest#aPublishedCardIsNotEditableAndANewPriceGoesThroughUnpublish` | червоний → після відкату зелений |
| `ProductRepository.publish`: прибрати `AND status = 'draft'` | `PublishTest#twoParallelPublishesOfOneDraftGiveOneOkAndOneInvalidState` | червоний → зелений |
| `BrandProfileService` з `HEAD` (стара регулярка) | `ConstraintFieldTest` | 3 з 6 червоні (усі українські випадки) → зелений |

### 1.3. Статистика прогону

| Перевірка | Команда | Результат |
| --- | --- | --- |
| Бекенд | `cd backend && ./mvnw verify` | **486 тестів, 42 класи, 0 падінь, 0 пропусків**, `BUILD SUCCESS`, 3 хв 14 с |
| Бекенд до аудиту | `./mvnw test -Dtest=BrandProfileTest` на `de1ded8` | **1 падіння** з 31 на українській локалі (`#aDatabaseRuleThatFailsIs400OnItsFieldNot500`); усього в наборі було 477 тестів (486 − 9 нових) |
| Фронтенд, Vitest | `npm --workspace frontend run test` | **58 файлів, 997 тестів, 0 падінь**, 5,6 с |
| Фронтенд, lint | `npm --workspace frontend run lint` | ESLint і Prettier — без зауважень |
| Фронтенд, типи | `npm --workspace frontend run typecheck` | `tsc` strict — без помилок |

Нові тести: `brandprofile/ConstraintFieldTest` (6) і три методи в `products/PublishTest` (15 → 18).

Найбільші класи: `ClothingFilterTest` 78, `SiteFetcherSafetyTest` 49, `HttpUrlValidatorTest` 46, `BrandProfileTest` 31, `BrandAuthTest` 30, `BrandSiteImportTest` 28, `ProductTest` 21, `BuyerRegisterTest` 20.

Особливості локального середовища. У `node_modules` бракувало пакета `motion`, і частина файлів Vitest падала з `Cannot find package 'motion/react'`. Після `npm install` за наявним lock-файлом усе зелене, вміст `package-lock.json` не змінився. Prettier скаржився на 6 файлів через CRLF у робочій копії (у git вони з LF). Після повторного checkout цих файлів зауважень немає.

## 2. Ручний smoke-чекліст інтерфейсу

Прогін 26.11.2026: `npm run dev` (профіль `dev`, демо-імпорт), вбудований браузер, тестовий бренд `smoke-qa-…@example.com`. ✅ пройдено, ❌ дефект, ⬜ не перевірялося в цьому прогоні.

**Покупець**

- ✅ `/`: банер, блок «Бренди» і каталог «Усі товари» завантажуються без входу.
- ⬜ Кнопку «Почати свайпати» не натискали: `/feed` відкривали напряму.
- ✅ `/feed` відкривається анонімно, без форм перед стрічкою (BR-03).
- ✅ Одне натискання «Не сьогодні» показує наступну картку за порядком `/api/feed`.
- ✅ Швидке подвійне натискання «Не сьогодні» пропускає рівно одну картку (US-10 S2).
- ✅ «Сподобалось» → у `/favorites` «1 з 25», картка з поточними назвою, брендом і ціною.
- ✅ «Перейти на сайт бренду» має `href` із `?utm_source=fulla`, `target="_blank"` і `rel="noopener noreferrer"`. Зовнішній сайт не відкривали.
- ⬜ Свайп-жести на справжньому телефоні.

**Кабінет бренду**

- ✅ `/brand/register` → `/brand`: назва, сайт без `https://`, «Згоду не надано», лічильники 0/0/0.
- ✅ Нова картка з ціною `-500`: текст «Вкажіть коректну ціну більше нуля та додайте фотографію товару», введені дані лишаються.
- ✅ Після виправлення ціни → `/brand/products`, рядок «Лляна сукня міді · 2400 грн · Чернетка».
- ✅ Без згоди «Опублікувати у стрічку» і масові кнопки `disabled`, є підказка з посиланням «Підтвердити згоду».
- ✅ Галочка згоди відкриває діалог підтвердження. Після «Підтвердити» і «Зберегти профіль» `GET /api/brand/profile` → `CONSENTED`.
- ✅ «Опублікувати у стрічку» → «Опубліковано», у `/api/feed` картка має рівно 6 полів `PublicCard`.
- ✅ «Зняти з публікації» → діалог → «Зняти»: статус «Чернетка», у `/api/feed` картки немає.
- ⬜ «Оновити з сайту» (імпорт): потребує звернення до сайту бренду, у цьому прогоні не запускали.

**Адаптивність, 320 px** (`document.documentElement.scrollWidth` при viewport 320)

- ✅ `/feed`: 320.
- ✅ `/favorites`: 320.
- ❌ `/`: 349, з'являється горизонтальна прокрутка. Причина: невидимий список для вимірювання розмірів у `frontend/src/shared/ProductCard/SizeRow.module.css` (`.measure { position: absolute; width: max-content; visibility: hidden }`). У картці біля правого краю він виходить за межі сторінки. Якщо сховати лише `.measure`, ширина повертається до 320.
- ❌ `/brand/products`: 322. Шапка кабінету (`nav.layout-nav`, кнопка «Вийти») ширша за екран на 2 px.
- ⬜ Клавіатура й скрінрідер.

Тестовий бренд «Smoke QA» і одна його чернетка лишилися в локальній dev-БД (`backend/.data/`). Скинути їх: зупинити бекенд і видалити `backend/.data/`.

## 3. Знайдені та виправлені баги

### Баг 1. Поле не визначається при українській локалі PostgreSQL

| | |
| --- | --- |
| Симптом | На Windows із локаллю `Ukrainian_Ukraine.1251` падає `BrandProfileTest#aDatabaseRuleThatFailsIs400OnItsFieldNot500`: `400 PROFILE_INVALID` з `fields: {}` замість `{"websiteUrl": "PROFILE_INVALID"}`. У лозі `answered 400 on field null`. |
| Причина | Вбудований Postgres бере `lc_messages` з ОС і пише `ПОМИЛКА: новий рядок для відношення "brand_profiles" порушує перевірне обмеження перевірку "brand_profiles_website_url_https"`. `BrandProfileService.blamedField` шукав ім'я регуляркою `constraint "([a-z_]+)"`, тобто за англійським словом. На CI (Linux, англійська локаль) тест зелений, тому баг пройшов рев'ю. |
| Виправлення | `backend/src/main/java/ua/fulla/brandprofile/BrandProfileService.java`: ім'я обмеження береться зі структурованого поля протоколу `PSQLException#getServerErrorMessage().getConstraint()`, яке не залежить від мови. Запасний шлях без цього поля шукає серед імен у лапках відоме обмеження з `CONSTRAINT_FIELDS`. «Значення задовге» розпізнається за `character varying(n)`: назву типу Postgres не перекладає. `backend/pom.xml`: драйвер PostgreSQL переведено зі `runtime` у `compile` scope, щоб імпортувати `PSQLException`. Нової залежності немає, драйвер уже в §2.3. |
| Регресійний тест | `backend/src/test/java/ua/fulla/brandprofile/ConstraintFieldTest.java`: справжній `PSQLException` з українським `ServerErrorMessage`, українське повідомлення без структурованого поля, англійське повідомлення, задовге значення українською для `varchar(50)` і `varchar(2048)`, невідоме обмеження → `null`. Тест не залежить від локалі машини. |

### Баг 2. Збереження сайту бренду → `500` замість валідації

| | |
| --- | --- |
| Джерело | `prompts/6.38_brand_website_save_500_and_url_cleanup.md`, виправлено в коміті `1b8f7ca` |
| Симптом | `/brand/profile`: сайт `https://goldi.ua/?srsltid=AYCX9…` → «Зберегти профіль» → «Сервіс тимчасово недоступний. Спробуйте пізніше». |
| Причина | Міграція `V20261126_1200__add_brand_website_url.sql` додала `website_url varchar(2048)` з `CHECK (… LIKE 'https://%')`. Сервіс не мав правила для поля і не обробляв помилок БД. `DataIntegrityViolationException` (CHECK або переповнення `varchar`) доходив до загального `@ExceptionHandler(Exception.class)` у `common/ApiExceptionHandler.java`, а той відповідає `500` з кодом `SERVICE_UNAVAILABLE`. |
| Виправлення | `common/WebsiteUrl.java` + `WebsiteUrlValidator.java`: лише `https://`, ≤ 2048, нормалізація з вилученням `srsltid`, `fbclid`, `gclid`, `utm_*`. `BrandProfileRepository` записує й повертає `website_url`. `BrandProfileService.writing()` перетворює порушення обмеження на `400 PROFILE_INVALID` з полем і логує стек. На фронтенді та сама нормалізація в `shared/validation.ts` (приклади в `shared/validation.examples.json`), поле очищується при втраті фокусу в `features/cabinet-profile/BrandProfilePage.tsx`. |
| Тести | `BrandProfileTest#websiteUrlIsSavedAndClearedWithTheProfile`, `#invalidWebsiteUrlIsRejectedAndNothingIsSaved`, `#httpGarbageAndTooLongWebsitesAre400OnTheField`, `#aDatabaseRuleThatFailsIs400OnItsFieldNot500`; `common/WebsiteUrlValidatorTest`; `features/cabinet-profile/profileForm.test.ts`. Саме цей фікс приніс баг 1: розбір тексту помилки БД працював лише англійською. |

### Баг 3. Головна кабінету `/brand` падала через `websiteUrl = undefined`

| | |
| --- | --- |
| Джерело | `prompts/6.36_brand_home_website_crash_and_error_page.md`, виправлено в коміті `1b8f7ca` |
| Симптом | Одразу після реєстрації бренду білий екран: `TypeError: Cannot read properties of undefined (reading 'trim') at withUtm (shared/links.ts:7) ← websiteLink (cabinetHome.ts:32) ← ProfileHeader (BrandHomePage.tsx:49)`. |
| Причина | Бекенд не повертав поле: `BrandProfileRepository.COLUMNS` і запис `BrandProfile` не містили `website_url`, тож у JSON ключа не було. `api/types.ts` оголошував `websiteUrl: string`, і `tsc` не вимагав перевірки. Виняток у рендері валив увесь маршрут, бо `errorElement` не було. |
| Виправлення | Бекенд повертає `websiteUrl` (`string \| null`). `shared/links.ts#withUtm` і `features/cabinet-home/cabinetHome.ts#websiteLink` приймають `string \| null \| undefined` і повертають `null` без винятку. Додано `shared/RouteError.tsx` як `errorElement` («Щось пішло не так», для кабінету кнопка «До кабінету»). |
| Тести | `shared/links.test.ts` (`it.each([undefined, null, "", "   "])`), `features/cabinet-home/BrandHomePage.test.tsx` (профіль без сайту), `shared/RouteError.test.tsx`. |

## 4. Інженерна рефлексія щодо роботи ШІ

| Що зробив ШІ | Де | Чому це погано | Як виправлено |
| --- | --- | --- | --- |
| Прив'язав логіку до **англійського тексту помилки БД** | `BrandProfileService.blamedField`, коміт `1b8f7ca` | Тест перевіряв поведінку лише на машині з англійською локаллю: зелений на CI і червоний у розробника з українською Windows. Повідомлення СУБД — текст для людини, а не контракт. | Структуроване поле `ServerErrorMessage#getConstraint()` + `ConstraintFieldTest` з українськими повідомленнями (баг 1). |
| **Підігнав дані під тест** замість сценарію | `ProductTest#brandWithoutSavedNameCannotCreateCards`, коміт `1b8f7ca` | Після того як реєстрація почала зберігати назву, стан «без назви» став недосяжним через API. ШІ не переглянув сценарій, а прибрав назву прямим `UPDATE brand_profiles SET name = NULL`, щоб тест знову позеленів. Тест перевіряє лише «старі дані», а не реальний шлях користувача. | Залишено свідомо: гейт T-2 у SQL усе ще потрібен для старих профілів, у тесті є коментар про це. У звіті позначено як тест захисної гілки, а не US-25.1 CL. |
| **Граничні значення** ціни й назви | `ProductTest#priceBoundariesAreAccepted` (1 і 1 000 000), `#invalidPriceIsCardInvalidPriceOrPhoto` (1 000 001), назва 1/100/101 | Межу 1 000 000 ШІ вписав у той самий коміт `9814422`, що й `@Max(1_000_000)` у `ProductController`. Тест повторював код, а не вимогу: `api.md` §3.2 каже лише «> upper bound». | Перевірено за документами: межа збігається з `data-model.md` (`CHECK (price_uah > 0 AND price_uah <= 1000000)`, Q-11), 100 символів — з G-15. Підгонки немає, але Q-11 відкритий: якщо межу змінять, оновлювати треба `data-model.md`, `@Max` і тест разом. |
| **Послідовна** подвійна публікація замість гонки | `PublishAcceptanceTest#us31_edge_aDoublePublishShowsTheCardOnceInTheFeed` | Тест називається «подвійний клік» (ADR-0009), але два запити йдуть один за одним. Він пройшов би і з check-then-update у Java, від чого T-1 якраз захищає. | Новий `PublishTest#twoParallelPublishesOfOneDraftGiveOneOkAndOneInvalidState`: два потоки, `CountDownLatch`, перевірено поломкою SQL. |
| INV-10 перевірено лише на **імпортованій** картці | `BrandSiteImportTest` (єдине місце з `CARD_NOT_EDITABLE`) | Для ручних карток (US-25.1, US-26) редагування не тестувалося зовсім: ні happy path, ні чужа картка, ні опублікована. | Нові `PublishTest#aPublishedCardIsNotEditableAndANewPriceGoesThroughUnpublish` і `#editingADraftHasTheCreateRulesAndOnlyTheOwnerMayEdit`. |
| **Копіювання хелперів** | `brand()`, `saveProfile()`, `createCard()`, `feedIds()`, `expectError()` дубльовано в 10 класах. JSON реєстрації бренду вписаний руками в 19 тестових файлах. | Кожна зміна тіла реєстрації (`name`, `websiteUrl`, `contactName`) — масова правка тестів: коміти `1b8f7ca` і `b9ffde0` змінили по 20 тестових файлів, а `de987a3` окремо латав забутий фікстур після злиття `main`. | Не рефакторилося в цьому PR (поза обсягом). Рекомендація: спільний `TestBrands` у тестовому пакеті `common` поруч із `ValidationExamples`. |
| Моки | вся тестова база | Перевірено: моків БД немає, `@MockitoSpyBean` лише для відкату T-9, `vi.mock` лише для анімації. | Змін не потрібно. |

### Розбіжності документів, знайдені під час аудиту (рішення за людиною)

- `GET /api/feed` повертає `sizes`, `colors`, `material`, `description` для імпортованих карток. Так дозволяє `docs/architecture/api.md` §2.2 (`FeedCard`), але це суперечить `CLAUDE.md` §6.3, ADR-0014 («not added to the API or shown») і `data-model.md` §5 («not returned by any endpoint»).
- У «Вподобаному» є кнопка «Прибрати з Вподобаного» (`shared/SavedProducts/SavedProducts.tsx`, промпти 6.7/6.8). У `CLAUDE.md` §1.2 US-17 (видалення з «Вподобаного») — Out of Scope, а улюблені описані як append-only.
- `FavoritesTest` перевіряє ліміт 100 збережених товарів, а `CLAUDE.md` §5.3 згадує лише ≤ 500 ID в одному запиті. `api.md` (≤ 100 у наборі) з кодом узгоджений.
