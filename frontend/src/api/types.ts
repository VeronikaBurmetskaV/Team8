// Written by hand from the API contract (docs/architecture/api.md, ADR-0003).

/** Same list as the Java enum ua.fulla.common.ErrorCode (api.md §3.2). */
export type ErrorCode =
  | "VALIDATION_FAILED"
  | "EMAIL_TAKEN_OR_INVALID"
  | "LOGIN_INVALID"
  | "PASSWORD_TOO_SHORT"
  | "INVALID_CREDENTIALS"
  | "EMAIL_NOT_FOUND"
  | "WRONG_PASSWORD"
  | "BRAND_NAME_MISMATCH"
  | "NAME_MISMATCH"
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
  | "FAVORITES_LIMIT_REACHED"
  // Brand site import (ADR-0017)
  | "SITE_NOT_SET"
  | "SITE_VERIFICATION_FAILED"
  | "SITE_NOT_VERIFIED"
  | "SITE_UNREACHABLE"
  | "SITE_ROBOTS_DISALLOWED"
  | "NO_PRODUCTS_FOUND"
  | "IMPORT_TOO_FREQUENT"
  | "IMPORT_FAILED"
  | "PRODUCT_NOT_ON_SITE"
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

/** POST /api/brand/login. */
export interface BrandCredentialsRequest {
  /**
   * «Назва бренду» (2026-12-02): must match the profile's name (trim, NFKC, any case, runs of
   * spaces = one); a mismatch is the same 401 INVALID_CREDENTIALS as a wrong password.
   */
  brandName: string;
  email: string;
  password: string;
}

/**
 * POST /api/brand/register (US-21): fields in form order; the contact person, name and website
 * go to the profile. `contactName` («Ваше імʼя»): required, 1–50 characters after trimming.
 */
export interface BrandRegisterRequest {
  contactName: string;
  name: string;
  websiteUrl: string;
  email: string;
  password: string;
}

/** Answer of brand register (201) and login (200). */
export interface BrandSessionResponse {
  brandId: string;
  email: string;
  profileState: ProfileState;
}

/** POST /api/buyer/register and POST /api/buyer/login (api.md §2.3). */
export interface BuyerCredentialsRequest {
  /** «Ваше імʼя» (2026-12-02): compared with the account's name like the brand name. */
  name: string;
  email: string;
  password: string;
}

/** POST /api/me/favorites (api.md §2.3): the only write of a registered buyer's favourites. */
export interface FavoritesRequest {
  productIds: string[];
}

/**
 * Answer of POST /api/me/favorites: the full list (oldest like first) and the new IDs that did
 * not fit under the account limit of 100 (ADR-0012).
 */
export interface FavoritesMergeResponse {
  productIds: string[];
  skippedIds: string[];
}

/** Answer of buyer register (201) and login (200). */
export interface BuyerSessionResponse {
  /** One of email / phone is set (the login), the other is null (ADR-0016). */
  email: string | null;
  phone: string | null;
  name: string | null;
}

/**
 * POST /api/buyer/register (US-02, ADR-0016): fields in form order. `login` is «Email або номер
 * телефону» as typed; the server decides which it is and normalizes it. `name` is required
 * (1–50 characters after trimming).
 */
export interface BuyerRegisterRequest {
  name: string;
  login: string;
  password: string;
}

/**
 * PUT /api/brand/profile. No `contactName` since 2026-12-02 (the profile page no longer edits it):
 * the server keeps the stored value when the field is left out.
 */
export interface BrandProfileRequest {
  name: string;
  /** Optional in the profile; null clears it. https:// with a domain, ≤ 2048. */
  websiteUrl: string | null;
  /** The brand's product feed (ADR-0017): https://, on the website's domain; null clears it. */
  feedUrl: string | null;
  logoImageId: string | null;
  logoUrl: string | null;
  consentGiven: boolean;
}

/** GET and PUT /api/brand/profile; `name` is null while the state is INCOMPLETE. */
export interface BrandProfileResponse {
  /** The contact person; null for brands registered before it was asked (2026-11-30). */
  contactName: string | null;
  name: string | null;
  websiteUrl: string | null;
  logoImageId: string | null;
  logoUrl: string | null;
  consentGiven: boolean;
  logoDisplayUrl: string | null;
  consentGivenAt: string | null;
  consentText: string | null;
  state: ProfileState;
  /** ADR-0017: the product feed, or null. */
  feedUrl: string | null;
  /** The verified domain of `websiteUrl` (e.g. «goldi.ua»); null while it is not verified. */
  siteDomain: string | null;
  siteVerifiedAt: string | null;
  /** For the meta tag or the fulla-verification.txt file; null from an older backend. */
  verificationToken: string | null;
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

/** One size of a product and whether it is in stock (api.md §2.2, imported cards only). */
export interface ProductSize {
  label: string;
  available: boolean;
}

/**
 * One colour of a product: a name for the tooltip and a `#rrggbb` swatch (api.md §2.2,
 * imported cards only). `hex` is null when the importer doesn't know the colour name.
 */
export interface ProductColor {
  name: string;
  hex: string | null;
}

/**
 * Card of the swipe feed (api.md §2.2): `PublicCard` plus optional details. Only cards from
 * the dev-only demo import (ADR-0014) have them; brand-made cards never do. The UI shows each
 * block only when it is present. The demo data (`features/feed/demoFeed.ts`) fills them too.
 */
export type FeedCard = PublicCard & {
  sizes?: ProductSize[];
  colors?: ProductColor[];
  material?: string;
  description?: string;
};

/** GET /api/feed (api.md §2.2). */
export interface FeedResponse {
  items: FeedCard[];
}

/**
 * GET /api/brands (api.md §2.2, ADR-0015): brands that have Published cards. `key` is the
 * catalogue's brand key; `logoUrl` is `/api/images/{id}`, an `https://` URL or null (no consent,
 * no logo, or an imported brand outside the dev demo).
 */
export interface BrandSummary {
  key: string;
  name: string;
  logoUrl: string | null;
  productCount: number;
}

/** Card as its brand sees it in the cabinet (api.md §2.1, §4.1). */
export type BrandCard = PublicCard & {
  photoImageId: string | null;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  createdAt: string;
  /** Only on a card imported from the brand's site (ADR-0017): where it was read. */
  sourceUrl?: string;
  /** Only on an imported card: the fields the brand changed by hand (imports keep them). */
  editedFields?: EditedField[];
  /**
   * «Немає на сайті» (ADR-0017): since when a complete sync no longer finds the card on the
   * brand's site. Left out while the site lists it. Such a card is a DRAFT that can't be published.
   */
  notOnSiteSince?: string;
};

/** A field of an imported card that the brand edited by hand (api.md §2.1). */
export type EditedField = "name" | "priceUah" | "photo" | "productUrl";

/** PUT /api/brand/products/{id}: the same body as create (only a Draft can be edited). */
export type UpdateProductRequest = CreateProductRequest;

/** POST /api/brand/products/publish (ADR-0017). */
/** POST /api/brand/products/unpublish (US-31 CL): the IDs back to Draft and the rest. */
export interface BulkUnpublishResponse {
  unpublishedIds: string[];
  skippedIds: string[];
}

export interface BulkPublishResponse {
  publishedIds: string[];
  skippedIds: string[];
}

/** POST /api/brand/site/verify (ADR-0017). */
export interface SiteVerifyResponse {
  siteDomain: string;
  siteVerifiedAt: string;
  method: "META_TAG" | "FILE" | "EMAIL_DOMAIN";
}

/** GET /api/brand/import/status and POST /api/brand/import (ADR-0017, api.md §2.1). */
export interface ImportStatus {
  status: "IDLE" | "RUNNING" | "DONE" | "FAILED";
  method: "FEED" | "SHOPIFY" | "SITEMAP" | null;
  startedAt: string | null;
  finishedAt: string | null;
  lastSuccessAt: string | null;
  /** When the last successful sync finished («Оновлено: …»); the same moment as lastSuccessAt. */
  lastSyncedAt: string | null;
  /** When the next import may start (10 min after the last start). */
  nextAllowedAt: string | null;
  found: number;
  created: number;
  updated: number;
  skipped: number;
  hidden: number;
  errorCode: ErrorCode | null;
  /** False only in demo mode (profile dev): no ownership check, no verification step. */
  verificationRequired: boolean;
  /** `!verificationRequired`. */
  demoMode: boolean;
}

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
