import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, getHealth } from "./client";

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getHealth", () => {
  it("returns the health body", async () => {
    stubFetch(200, { status: "UP" });
    await expect(getHealth()).resolves.toEqual({ status: "UP" });
    expect(fetch).toHaveBeenCalledWith("/api/health", expect.anything());
  });

  it("turns the error envelope into an ApiError", async () => {
    stubFetch(404, {
      error: { code: "NOT_FOUND", message: "No such resource" },
    });
    const error = await getHealth().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("reports a response without an envelope as SERVICE_UNAVAILABLE", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response("Bad Gateway", { status: 502 })),
      ),
    );
    await expect(getHealth()).rejects.toMatchObject({
      status: 502,
      code: "SERVICE_UNAVAILABLE",
    });
  });
});
