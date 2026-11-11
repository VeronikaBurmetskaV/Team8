package ua.fulla.common;

/**
 * Error codes of the API contract (docs/architecture/api.md §3.2).
 * Must stay identical to the {@code ErrorCode} union in frontend/src/api/types.ts.
 */
public enum ErrorCode {
    VALIDATION_FAILED,
    EMAIL_TAKEN_OR_INVALID,
    PASSWORD_TOO_SHORT,
    INVALID_CREDENTIALS,
    UNAUTHENTICATED,
    FORBIDDEN,
    NOT_FOUND,
    PROFILE_INVALID,
    CONSENT_LOCKED,
    PROFILE_INCOMPLETE,
    IMAGE_INVALID,
    CARD_INVALID_NAME,
    CARD_INVALID_PRICE_OR_PHOTO,
    CARD_INVALID_URL,
    CARD_NOT_EDITABLE,
    CONSENT_REQUIRED,
    PUBLISH_FIELDS_MISSING,
    INVALID_STATE,
    TOO_MANY_REQUESTS,
    SERVICE_UNAVAILABLE
}
