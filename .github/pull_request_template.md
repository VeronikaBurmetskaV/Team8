## Що змінено

<!-- Story ID(s), e.g. US-25.1; one story slice per PR, ideally < 400 changed lines. -->

## Чек-лист (CLAUDE.md §7, ADR-0011)

- [ ] Story ID(s) named; change is one story slice.
- [ ] API changed? → `docs/contracts/api.md` and `frontend/src/api/types.ts` updated in this PR; MockMvc test asserts the JSON field names.
- [ ] New error code? → added to the Java `ErrorCode` enum, the contract dictionary, the TS `ErrorCode` union **and** `messages.uk.ts` (exact Ukrainian text from the story).
- [ ] Schema changed? → new timestamped Flyway migration + repository test on embedded Postgres.
- [ ] Validation rule changed? → Bean Validation and zod schema updated with the same examples in JUnit and Vitest.
- [ ] No new dependency outside §2.3.
- [ ] `./mvnw verify` and frontend lint + typecheck + test pass locally.

## Proposals / open questions to confirm

<!-- Items marked (proposal) or Q-xx in the architecture docs that this PR implements. -->
