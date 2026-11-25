# Тестова стратегія FULLA

## 1. Межі

**Автотести покривають:**

| Сценарій / правило                                                                           | Де       | Приклад                                                                                              |
| -------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| Реєстрація, вхід, вихід бренду; гонка двох реєстрацій → один `409` (US-21, US-21.1, NFR-04)  | бекенд   | `brandauth/BrandAuthTest`, `BrandRegistrationAtomicityTest` (T-9)                                    |
| Профіль: назва, одностороння згода, текст згоди (US-22.1, US-22.2, INV-09)                   | бекенд   | `brandprofile/BrandProfileTest`                                                                      |
| Створення картки, валідація полів, свої фото, чужі → 404 (US-25.1, US-26, T-2, T-8)          | бекенд   | `products/ProductTest`                                                                               |
| Публікація: без згоди → `CONSENT_REQUIRED`, повтор → `INVALID_STATE`, republish (US-31, T-1) | бекенд   | `products/PublishTest`                                                                               |
| Стрічка: лише Published, публічні поля, порядок (US-08.1, INV-01, INV-03)                    | бекенд   | `feed/FeedTest`                                                                                      |
| Зображення: magic bytes, ≤ 5 МБ, кешування (ADR-0007)                                        | бекенд   | `images/ImageTest`, `ImageUploadHttpTest`                                                            |
| Реєстрація покупця, ролі BRAND/BUYER (US-02)                                                 | бекенд   | `buyer/BuyerRegisterTest`                                                                            |
| Ліміт спроб входу, схема БД, `GET /api/session`                                              | бекенд   | `brandauth/AttemptLimitTest`, `common/SchemaMigrationTest`                                           |
| Like/skip за ID, повторна дія ігнорується (US-09, US-10 S2, INV-05)                          | фронтенд | `features/feed/queue.test.ts`                                                                        |
| UTM-посилання на сайт бренду (US-19, US-32)                                                  | фронтенд | `shared/links.test.ts`                                                                               |
| Схеми форм і тексти помилок                                                                  | фронтенд | `shared/validation.test.ts`, `shared/errors.test.ts`                                                 |
| API-клієнт: CSRF-заголовок, конверт помилки, 401 → логін                                     | фронтенд | `api/client.test.ts`                                                                                 |
| Сторінки кабінету за станом профілю                                                          | фронтенд | `features/cabinet-home/BrandHomePage.test.tsx`, `features/cabinet-profile/BrandProfilePage.test.tsx` |

**Свідомо вручну** (перед демо і перед злиттям UI-PR):

- верстка й візуальне оформлення від 320 px, відповідність макетам — автотест не скаже, чи «гарно»;
- свайп-жести й анімація `motion` на справжньому телефоні — залежать від сенсора й браузера;
- відкриття сайту бренду в новій вкладці, демо через Wi-Fi (`vite --host`) і `cloudflared`;
- доступність: проходження клавіатурою, озвучення скрінрідером;
- повний шлях «бренд публікує → покупець бачить у `/feed`» у браузері.

## 2. Рівні тестів та інструменти

| Рівень             | Інструмент                                                                   | Що перевіряє                                                                         |
| ------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| API / інтеграційні | JUnit 5, `@SpringBootTest` + MockMvc, zonky `embedded-database-spring-test`  | HTTP-статус, код помилки, назви JSON-полів, сесія, CSRF, реальний SQL і обмеження БД |
| Справжній HTTP     | `@SpringBootTest(webEnvironment = RANDOM_PORT)`                              | cookie сесії, multipart до 5 МБ (`BrandAuthHttpTest`, `ImageUploadHttpTest`)         |
| Unit (бекенд)      | JUnit 5, `@ParameterizedTest`                                                | валідатори `@HttpUrl` / HTTPS, magic bytes, ліміт спроб, розбір імпорту на фікстурах |
| Unit (фронтенд)    | Vitest                                                                       | чисті функції й reducer-и: черга стрічки, `withUtm`, схеми zod, ціна                 |
| Компонентні        | Vitest + `renderToString`, `QueryClient` із заповненим кешем, `MemoryRouter` | що сторінка показує за даними, без мережі                                            |
| Статичні           | `tsc` (strict), ESLint + Prettier                                            | типи контракту, `Record<ErrorCode, string>` не пропускає код без тексту              |

БД у тестах не мокається: гарантії FULLA — це SQL (умовний `UPDATE`, `UNIQUE`, `ON CONFLICT`), тож перевіряти їх без Postgres немає сенсу (ADR-0009). Docker, H2 і Testcontainers заборонені.

## 3. Організація та дані

- **Бекенд:** `backend/src/test/java/ua/fulla/<feature>/<Name>Test.java`, дзеркально до пакетів коду. Фікстури (HTML, XML імпорту) лежать у `backend/src/test/resources/catalogimport/`. `src/test/resources/config/application.yml` піднімає ліміт спроб входу для тестів.
- **Фронтенд:** `*.test.ts` / `*.test.tsx` поруч із кодом, який тестують.
- **Ізоляція БД:** `@AutoConfigureEmbeddedDatabase(provider = ZONKY)` піднімає окремий вбудований Postgres. Кожен Spring-контекст отримує свою порожню базу, на яку Flyway накочує міграції. Класи з однаковою конфігурацією ділять контекст, а отже й базу, тому кожен тест створює **власні унікальні дані**: `uniqueEmail()` / `"brand-" + UUID.randomUUID() + "@example.com"`. `DELETE`/`TRUNCATE` не потрібні й не використовуються (на бізнес-таблицях вони заборонені).
- **Мережа:** тести імпорту працюють лише на локальних фікстурах. `CatalogSyncTest.networkPartOfTheImportDoesNotExistInTests` гарантує, що сайти брендів не викликаються.
- **Фронтенд:** кожен рендер створює новий `QueryClient`. Браузерні глобали підмінюються через `vi.stubGlobal` і відновлюються в `afterEach` (`vi.unstubAllGlobals`). Замість localStorage — `memoryStorage()` / `brokenStorage()` із `shared/testStorage.ts`.
- **Локальна dev-БД** (`backend/.data/`) тестами не використовується. Скинути її: зупинити бекенд і видалити `backend/.data/`.
- **Тестові облікові дані** лише фейкові (`@example.com`, `secret-123`), без секретів.

## Запуск і CI

```bash
cd backend && ./mvnw verify                 # усі бекенд-тести
cd backend && ./mvnw test -Dtest=PublishTest  # один клас
npm --workspace frontend run lint
npm --workspace frontend run typecheck
npm --workspace frontend run test
npm test                                    # фронтенд-тести + ./mvnw verify
```

`.github/workflows/ci.yml` на кожен PR у `main` і push у `main`: Java 21 + Node з `.nvmrc`, `npm ci`, lint, typecheck, Vitest, `./mvnw -B verify`. `main` приймає лише зелений CI й один рев'ю. Тести не вимикаються й не послаблюються, щоб CI став зеленим.
