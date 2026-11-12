import type {
  ApiErrorBody,
  BrandCard,
  CreateProductRequest,
  ErrorCode,
  ImageUploadResponse,
} from "./types";

/** Any non-2xx answer from /api, reduced to what the UI needs. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly fields: Partial<Record<string, ErrorCode>>;

  constructor(
    status: number,
    code: ErrorCode,
    fields: Partial<Record<string, ErrorCode>> = {},
  ) {
    super(code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value))
    return false;
  const error = (value as { error: unknown }).error;
  return typeof error === "object" && error !== null && "code" in error;
}

async function toApiError(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null);
  if (isErrorBody(body)) {
    return new ApiError(response.status, body.error.code, body.error.fields);
  }
  // No envelope: the proxy or the network answered, not the API.
  return new ApiError(response.status, "SERVICE_UNAVAILABLE");
}

/** The XSRF-TOKEN cookie is set by GET /api/session; read on every call (ADR-0006). */
function csrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/** No session on a cabinet or buyer endpoint: send the user to the right login page. */
function redirectToLogin(path: string): void {
  let loginPage: string | null = null;
  // Uploading an image is a brand action (api.md §2.1).
  if (path.startsWith("/api/brand/") || path.startsWith("/api/images")) {
    loginPage = "/brand/login";
  }
  if (path.startsWith("/api/me/")) loginPage = "/login";
  if (loginPage === null || typeof location === "undefined") return;
  if (location.pathname !== loginPage) {
    location.assign(loginPage);
  }
}

async function request<T>(
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (method !== "GET") {
    const token = csrfToken();
    if (token !== null) headers["X-XSRF-TOKEN"] = token;
  }
  // For multipart the browser sets the Content-Type with the boundary itself.
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(path, {
    method,
    headers,
    credentials: "same-origin",
    body: body === undefined || isForm ? body : JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await toApiError(response);
    // By code, not by status: a wrong password is also a 401 (INVALID_CREDENTIALS).
    if (error.code === "UNAUTHENTICATED") redirectToLogin(path);
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>("GET", path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("POST", path, body);
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return request<T>("PUT", path, body);
}

/** Multipart POST (image upload). */
export function apiUpload<T>(path: string, form: FormData): Promise<T> {
  return request<T>("POST", path, form);
}

export function getBrandProducts(): Promise<BrandCard[]> {
  return apiGet<BrandCard[]>("/api/brand/products");
}

export function createBrandProduct(
  body: CreateProductRequest,
): Promise<BrandCard> {
  return apiPost<BrandCard>("/api/brand/products", body);
}

/** The multipart field name `file` is an assumption: api.md does not name it. */
export function uploadImage(file: File): Promise<ImageUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  return apiUpload<ImageUploadResponse>("/api/images", form);
}
