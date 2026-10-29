// Written by hand from the API contract (docs/architecture/api.md, ADR-0003).

/** Same list as the Java enum ua.fulla.common.ErrorCode (api.md §3.2). */
export type ErrorCode =
  | "VALIDATION_FAILED"
  | "EMAIL_TAKEN_OR_INVALID"
  | "PASSWORD_TOO_SHORT"
  | "INVALID_CREDENTIALS"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "PROFILE_INVALID"
  | "CONSENT_LOCKED"
  | "PROFILE_INCOMPLETE"
  | "IMAGE_INVALID"
  | "CARD_INVALID_NAME"
  | "CARD_INVALID_PRICE_OR_PHOTO"
  | "CARD_INVALID_URL"
  | "CARD_NOT_EDITABLE"
  | "CONSENT_REQUIRED"
  | "PUBLISH_FIELDS_MISSING"
  | "INVALID_STATE"
  | "TOO_MANY_REQUESTS"
  | "SERVICE_UNAVAILABLE";

/** The single error envelope (api.md §3.1). */
export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    fields?: Record<string, ErrorCode>;
  };
}

/** GET /api/health — walking skeleton, not in api.md yet. */
export interface HealthResponse {
  status: "UP";
}
