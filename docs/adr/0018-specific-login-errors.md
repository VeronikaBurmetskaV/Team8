# ADR-0018: Login errors say which field is wrong

## Status
Proposed — 2026-12-02. Amends ADR-0006 (auth) and the checklist line of US-21.1 / US-03 «login errors never reveal which field is wrong». Decided by the team: usability over hiding which emails are registered.

## Context
Until now every failed login answered one `401 INVALID_CREDENTIALS` with one text, so the response never told whether an email is registered (no account enumeration). Since 2026-12-02 the brand login also asks for the brand name. With three fields and one common text («Неправильні дані для входу. Перевірте назву бренду, пошту й пароль») users could not tell what to fix, and brands with several people sharing one cabinet kept guessing.

## Options
1. **One common error (status quo).**
   \+ Nobody can learn from the login form whether an email has an account.
   − Users don't know which of three fields to fix; more support requests.
2. **Say what exactly is wrong, checked in a fixed order (chosen).**
   \+ Each error is shown under its field with a way out («Зареєструватися», «Забули пароль?»).
   − The login form tells whether an email is registered (account enumeration); with the right password it also tells that the brand name differs.
3. **Say what is wrong only after a successful email confirmation (magic link, codes).**
   \+ Usable and private.
   − Needs sending emails, which the MVP does not have (ADR-0006, postponed).

## Decision
Option 2, a conscious trade-off:
- `POST /api/brand/login` checks, in this order, and the first failure answers `401` with its own code and the field in `fields`:
  1. the email has no account (or can't be one) → `EMAIL_NOT_FOUND`, `fields.email`;
  2. the password is wrong → `WRONG_PASSWORD`, `fields.password`;
  3. the brand name differs (trim, NFKC, any case, runs of spaces = one) → `BRAND_NAME_MISMATCH`, `fields.brandName`.
- The brand name is checked **only after** the right email and password, so the name of a brand can't be learnt without its password. A brand without a saved name logs in by email + password (unchanged).
- Buyer login (US-03, not built yet) will follow the same order with `NAME_MISMATCH`, `fields.name`; the form already handles these codes.
- **Protection:** the existing attempt limit stays (`AttemptLimiter`, ADR-0006): every login and register attempt from one IP counts — successful or not, whatever the failure — and above the limit (10 per minute in prod) the answer is `429 TOO_MANY_REQUESTS` («Забагато спроб. Спробуйте за кілька хвилин»). This slows down guessing which emails exist; it does not prevent it.
- Registration keeps its neutral `409 EMAIL_TAKEN_OR_INVALID` (ADR-0016); only the login form reveals registered emails.
- `INVALID_CREDENTIALS` stays in the dictionary but is no longer returned by the brand login.

## Consequences
- **Simpler:** users see what to fix under the field, with the focus on it.
- **Harder:** anyone can check whether an email has a FULLA account (up to the attempt limit per IP; many IPs bypass it). The timing equalization of the login (BCrypt with a dummy hash for unknown emails) is removed, because the answer itself already tells.
- **Revisit:** before public hosting (ADR-0010), with email verification or a CAPTCHA, or go back to one common error.
- **Docs to align (human decision):** US-21.1 CL / US-03 CL and CLAUDE.md §5.2 still say «login errors never reveal which field is wrong».

## Related stories
US-21.1, US-03; ADR-0006, ADR-0016.
