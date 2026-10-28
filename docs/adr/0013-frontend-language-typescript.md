# ADR-0013: Frontend language — TypeScript (strict)

## Status
Proposed — 2026-10-28

## Context
Two frontend developers with basic JavaScript/React. Claude Code writes most of the code; the humans review and adjust it. The API contract arrives as generated types from `contract/openapi.json` (ADR-0005). The Ukrainian UI texts are keyed by API error codes (`messages.uk.ts`), and every code must have a text.

## Options
1. **TypeScript, `strict`.**
   + Generated API types and `Record<ErrorCode, string>` work fully: a new backend error code without a Ukrainian text, or a renamed field, fails `tsc` in CI. Catches the `null`/`undefined` mistakes generated code often makes.
   − New syntax for the FE devs; strict errors can feel like friction in week 1.
2. **TypeScript, non-strict.**
   + Gentler start.
   − Misses exactly the null/undefined bugs that are most common.
3. **Plain JavaScript (or JS + JSDoc `@ts-check`).**
   + Nothing new to learn (JSDoc: types without new syntax).
   − Contract changes surface only at runtime; generated types are mostly wasted; JSDoc types are verbose and less familiar than TS.

## Decision
Option 1. TS `strict` in `frontend/`. Allowed escape hatch during learning: a `// TODO(types)` comment with an explicit cast, never `any` in shared code (`src/shared`, `src/api`).

## Consequences
- **Simpler:** the compiler checks Claude Code's output and the API contract on every PR; the editor shows endpoint shapes while typing.
- **Harder:** FE devs learn basic TS (types, unions, generics only as used) in week 1; reviews need to read type errors.
- **Postponed:** advanced typing (generic components, branded types).
- **Would change if:** after week 1 the FE devs can't work with strict mode. Then switch to non-strict, keeping TS.

## Related stories
Cross-cutting for all buyer and cabinet screens; most visible for forms with error codes: US-02, US-03, US-21, US-21.1, US-22.1, US-25.1, US-26, US-31.
