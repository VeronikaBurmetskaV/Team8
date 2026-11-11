import type { ApiErrorBody, ErrorCode, HealthResponse } from "./types";

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
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/** No session on a cabinet or buyer endpoint: send the user to the right login page. */
function redirectToLogin(path: string): void {
  let loginPage: string | null = null;
  if (path.startsWith("/api/brand/")) loginPage = "/brand/login";
  if (path.startsWith("/api/me/")) loginPage = "/login";
  if (loginPage !== null && location.pathname !== loginPage) {
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
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(path, {
    method,
    headers,
    credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body),
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

export function getHealth(): Promise<HealthResponse> {
  return apiGet<HealthResponse>("/api/health");
}
