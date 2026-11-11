import type {
  ApiErrorBody,
  BrandCard,
  CreateProductRequest,
  ErrorCode,
  HealthResponse,
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

/** CSRF: the value of the XSRF-TOKEN cookie goes into X-XSRF-TOKEN (api.md §1). */
function csrfHeaders(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const pair = document.cookie
    .split("; ")
    .find((item) => item.startsWith("XSRF-TOKEN="));
  if (!pair) return {};
  return {
    "X-XSRF-TOKEN": decodeURIComponent(pair.slice("XSRF-TOKEN=".length)),
  };
}

/** No session on a brand endpoint → the brand login page (api.md §3.2). */
function redirectIfUnauthenticated(path: string, error: ApiError): void {
  if (error.status !== 401 || error.code !== "UNAUTHENTICATED") return;
  const brandOnly =
    path.startsWith("/api/brand/") || path.startsWith("/api/images");
  if (!brandOnly || typeof window === "undefined") return;
  if (window.location.pathname !== "/brand/login") {
    window.location.assign("/brand/login");
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, credentials: "same-origin" });
  if (!response.ok) {
    const error = await toApiError(response);
    redirectIfUnauthenticated(path, error);
    throw error;
  }
  return (await response.json()) as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { headers: { Accept: "application/json" } });
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...csrfHeaders(),
    },
    body: JSON.stringify(body),
  });
}

/** Multipart POST; the browser sets the Content-Type with the boundary. */
export function apiUpload<T>(path: string, form: FormData): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { Accept: "application/json", ...csrfHeaders() },
    body: form,
  });
}

export function getHealth(): Promise<HealthResponse> {
  return apiGet<HealthResponse>("/api/health");
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
