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

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as T;
}

export function getHealth(): Promise<HealthResponse> {
  return apiGet<HealthResponse>("/api/health");
}
