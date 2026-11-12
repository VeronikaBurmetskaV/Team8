// One list of valid/invalid inputs for the card form. The backend validation
// tests must use the same examples (R-T17), so keep this file plain data.
import urlExamples from "./validation.examples.json";

export interface ValidationExample {
  value: string;
  valid: boolean;
}

export const cardNameExamples: ValidationExample[] = [
  { value: "", valid: false },
  { value: "   ", valid: false },
  { value: "Лляна сукня міді", valid: true },
  { value: "a".repeat(100), valid: true },
  { value: "a".repeat(101), valid: false },
];

export const cardPriceExamples: ValidationExample[] = [
  { value: "2400", valid: true },
  { value: "1", valid: true },
  { value: "1000000", valid: true },
  { value: "", valid: false },
  { value: "-500", valid: false },
  { value: "0", valid: false },
  { value: "abc", valid: false },
  { value: "12.5", valid: false },
  { value: "1000001", valid: false },
];

/**
 * URL examples shared with the backend tests (final-review №6): kept in
 * validation.examples.json so JUnit reads exactly the same list.
 * `httpUrl` = @HttpUrl / isHttpUrl (product link), `httpsUrl` = @HttpsUrl /
 * isHttpsUrl (photo and logo URL).
 */
export const httpUrlExamples: ValidationExample[] = urlExamples.httpUrl;
export const httpsUrlExamples: ValidationExample[] = urlExamples.httpsUrl;
