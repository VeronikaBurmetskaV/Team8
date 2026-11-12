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

/** Derived on the server from the brand name and the consent (api.md §2.1). */
export type ProfileState = "INCOMPLETE" | "ACTIVE" | "CONSENTED";

/** GET /api/session (api.md §2.2); both fields are null when nobody is logged in. */
export interface SessionResponse {
  accountType: "BRAND" | "BUYER" | null;
  email: string | null;
}

/** POST /api/brand/register and POST /api/brand/login. */
export interface BrandCredentialsRequest {
  email: string;
  password: string;
}

/** Answer of brand register (201) and login (200). */
export interface BrandSessionResponse {
  brandId: string;
  email: string;
  profileState: ProfileState;
}

/** PUT /api/brand/profile. */
export interface BrandProfileRequest {
  name: string;
  logoImageId: string | null;
  logoUrl: string | null;
  consentGiven: boolean;
}

/** GET and PUT /api/brand/profile; `name` is null while the state is INCOMPLETE. */
export interface BrandProfileResponse {
  name: string | null;
  logoImageId: string | null;
  logoUrl: string | null;
  consentGiven: boolean;
  logoDisplayUrl: string | null;
  consentGivenAt: string | null;
  consentText: string | null;
  state: ProfileState;
}

/** Card as buyers see it (api.md §2.2). */
export interface PublicCard {
  id: string;
  name: string;
  brandName: string;
  priceUah: number;
  /** `/api/images/{id}` or the brand's `https://` URL. */
  photoUrl: string;
  productUrl: string;
}

/** Card as its brand sees it in the cabinet (api.md §2.1, §4.1). */
export type BrandCard = PublicCard & {
  photoImageId: string | null;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  createdAt: string;
};

/** POST /api/brand/products — exactly one of photoImageId / photoUrl is set (api.md §4.1). */
export interface CreateProductRequest {
  name: string;
  priceUah: number;
  photoImageId: string | null;
  photoUrl: string | null;
  productUrl: string;
}

/** POST /api/images (api.md §2.1). */
export interface ImageUploadResponse {
  id: string;
  url: string;
}
