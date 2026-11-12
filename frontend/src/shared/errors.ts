import { ApiError } from "../api/client";
import type { ErrorCode } from "../api/types";
import { isErrorCode, messages } from "./messages.uk";

/**
 * The code to show for anything a request can throw. Not an ApiError (the network is down,
 * `fetch` threw) or a code outside the dictionary → SERVICE_UNAVAILABLE.
 */
export function errorCodeOf(error: unknown): ErrorCode {
  return error instanceof ApiError && isErrorCode(error.code)
    ? error.code
    : "SERVICE_UNAVAILABLE";
}

/** The Ukrainian text for anything a request can throw. */
export function errorMessage(error: unknown): string {
  return messages[errorCodeOf(error)];
}

/** Where a failed submit is shown: under the fields, or once for the whole form. */
export interface FormErrors<Field extends string> {
  fields: Partial<Record<Field, ErrorCode>>;
  /** Set only when no field took the error. */
  form: ErrorCode | null;
}

/**
 * Spreads the `fields` of the error envelope over the inputs of a form.
 * `fieldByRequestName` maps a request field to the input that shows its error;
 * when two request fields share an input, the first one wins.
 */
export function toFormErrors<Field extends string>(
  error: unknown,
  fieldByRequestName: Partial<Record<string, Field>>,
): FormErrors<Field> {
  const fields: Partial<Record<Field, ErrorCode>> = {};
  let shownAtField = false;
  if (error instanceof ApiError) {
    for (const [requestName, code] of Object.entries(error.fields)) {
      const field = Object.hasOwn(fieldByRequestName, requestName)
        ? fieldByRequestName[requestName]
        : undefined;
      if (field === undefined || !code || Object.hasOwn(fields, field)) {
        continue;
      }
      fields[field] = isErrorCode(code) ? code : "SERVICE_UNAVAILABLE";
      shownAtField = true;
    }
  }
  return { fields, form: shownAtField ? null : errorCodeOf(error) };
}
