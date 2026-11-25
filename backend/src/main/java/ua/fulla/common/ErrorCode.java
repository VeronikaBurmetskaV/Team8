package ua.fulla.common;

/**
 * Error codes of the API contract (docs/architecture/api.md §3.2).
 * Must stay identical to the {@code ErrorCode} union in frontend/src/api/types.ts.
 */
public enum ErrorCode {
    VALIDATION_FAILED,
    EMAIL_TAKEN_OR_INVALID,
    LOGIN_INVALID,
    PASSWORD_TOO_SHORT,
    INVALID_CREDENTIALS,
    // Login: what exactly is wrong (ADR-0018), checked in this order
    EMAIL_NOT_FOUND,
    WRONG_PASSWORD,
    BRAND_NAME_MISMATCH,
    /** Buyer login (US-03), once POST /api/buyer/login exists. */
    NAME_MISMATCH,
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
    FAVORITES_LIMIT_REACHED,
    // Brand site import (ADR-0017)
    SITE_NOT_SET,
    SITE_VERIFICATION_FAILED,
    SITE_NOT_VERIFIED,
    SITE_UNREACHABLE,
    SITE_ROBOTS_DISALLOWED,
    NO_PRODUCTS_FOUND,
    IMPORT_TOO_FREQUENT,
    IMPORT_FAILED,
    /** Publish of a card the brand's site no longer lists («Немає на сайті», ADR-0017). */
    PRODUCT_NOT_ON_SITE,
    TOO_MANY_REQUESTS,
    SERVICE_UNAVAILABLE
}
