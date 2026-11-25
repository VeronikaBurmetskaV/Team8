/**
 * The one Node API the tests use: reading a stylesheet as text (Vitest does not load CSS, and
 * @types/node is not a dependency of the app). Tests run in Node, where this exists.
 */
declare module "node:fs" {
  export function readFileSync(path: string, encoding: "utf8"): string;
}
