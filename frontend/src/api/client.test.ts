import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  apiGet,
  apiPost,
  apiPut,
  createBrandProduct,
  uploadImage,
} from "./client";

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

/** Vitest runs in node: the browser globals the client reads are stubbed. */
function stubBrowser(cookie: string, pathname = "/") {
  const assign = vi.fn();
  vi.stubGlobal("document", { cookie });
  vi.stubGlobal("location", { pathname, assign });
  return assign;
}

function lastRequestInit(): RequestInit {
  const init = vi.mocked(fetch).mock.calls.at(-1)?.[1];
  if (init === undefined) throw new Error("fetch was not called with options");
  return init;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiGet", () => {
  const getSession = () => apiGet("/api/session");

  it("returns the response body", async () => {
    stubFetch(200, { accountType: null, email: null });
    await expect(getSession()).resolves.toEqual({
      accountType: null,
      email: null,
    });
    expect(fetch).toHaveBeenCalledWith("/api/session", expect.anything());
  });

  it("turns the error envelope into an ApiError", async () => {
    stubFetch(404, {
      error: { code: "NOT_FOUND", message: "No such resource" },
    });
    const error = await getSession().catch((e: unknown) => e);
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
    await expect(getSession()).rejects.toMatchObject({
      status: 502,
      code: "SERVICE_UNAVAILABLE",
    });
  });
});

describe("apiPost and apiPut", () => {
  it("sends the JSON body and the CSRF token from the cookie", async () => {
    stubBrowser("other=1; XSRF-TOKEN=token-123");
    const session = {
      brandId: "b1",
      email: "info@brand.ua",
      profileState: "INCOMPLETE",
    };
    stubFetch(201, session);
    const credentials = { email: "info@brand.ua", password: "secret-123" };

    await expect(apiPost("/api/brand/register", credentials)).resolves.toEqual(
      session,
    );

    expect(fetch).toHaveBeenCalledWith(
      "/api/brand/register",
      expect.anything(),
    );
    const init = lastRequestInit();
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect(init.body).toBe(JSON.stringify(credentials));
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-XSRF-TOKEN": "token-123",
    });
  });

  it("uses PUT for apiPut", async () => {
    stubBrowser("XSRF-TOKEN=token-123");
    stubFetch(200, { name: "Lileya", state: "ACTIVE" });
    await apiPut("/api/brand/profile", { name: "Lileya" });
    const init = lastRequestInit();
    expect(init.method).toBe("PUT");
    expect(init.headers).toMatchObject({ "X-XSRF-TOKEN": "token-123" });
  });

  it("sends no CSRF header when the cookie is missing", async () => {
    stubBrowser("");
    stubFetch(403, {
      error: { code: "FORBIDDEN", message: "Access denied" },
    });
    await expect(apiPost("/api/brand/login", {})).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });
    expect(lastRequestInit().headers).not.toHaveProperty("X-XSRF-TOKEN");
  });

  it("resolves a 204 without a body, and sends none when none is given", async () => {
    stubBrowser("XSRF-TOKEN=token-123");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))),
    );
    await expect(apiPost("/api/brand/logout")).resolves.toBeUndefined();
    const init = lastRequestInit();
    expect(init.body).toBeUndefined();
    expect(init.headers).not.toHaveProperty("Content-Type");
  });

  it("keeps the field codes of the envelope", async () => {
    stubBrowser("XSRF-TOKEN=token-123");
    stubFetch(400, {
      error: {
        code: "EMAIL_TAKEN_OR_INVALID",
        message: "email must look like name@domain.tld",
        fields: {
          email: "EMAIL_TAKEN_OR_INVALID",
          password: "PASSWORD_TOO_SHORT",
        },
      },
    });
    await expect(apiPost("/api/brand/register", {})).rejects.toMatchObject({
      status: 400,
      code: "EMAIL_TAKEN_OR_INVALID",
      fields: {
        email: "EMAIL_TAKEN_OR_INVALID",
        password: "PASSWORD_TOO_SHORT",
      },
    });
  });
});

describe("401 handling", () => {
  const unauthenticated = {
    error: { code: "UNAUTHENTICATED", message: "Authentication required" },
  };

  it("sends the brand to /brand/login when the session is gone", async () => {
    const assign = stubBrowser("", "/brand/profile");
    stubFetch(401, unauthenticated);
    await expect(apiGet("/api/brand/profile")).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
    });
    expect(assign).toHaveBeenCalledWith("/brand/login");
  });

  it("sends the buyer to /login", async () => {
    const assign = stubBrowser("XSRF-TOKEN=token-123", "/favorites");
    stubFetch(401, unauthenticated);
    await expect(apiPost("/api/me/favorites", {})).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(assign).toHaveBeenCalledWith("/login");
  });

  it("does not redirect on a wrong password", async () => {
    const assign = stubBrowser("XSRF-TOKEN=token-123", "/brand/login");
    stubFetch(401, {
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      },
    });
    await expect(apiPost("/api/brand/login", {})).rejects.toMatchObject({
      status: 401,
      code: "INVALID_CREDENTIALS",
    });
    expect(assign).not.toHaveBeenCalled();
  });

  it("does not reload the login page the user is already on", async () => {
    const assign = stubBrowser("XSRF-TOKEN=token-123", "/brand/login");
    stubFetch(401, unauthenticated);
    await expect(apiPost("/api/brand/logout")).rejects.toBeInstanceOf(ApiError);
    expect(assign).not.toHaveBeenCalled();
  });
});

describe("brand product helpers", () => {
  const body = {
    name: "Лляна сукня міді",
    priceUah: 2400,
    photoImageId: null,
    photoUrl: "https://cdn.brand-site.ua/dress.webp",
    productUrl: "https://brand-site.ua/linen-dress",
  };

  it("sends the XSRF-TOKEN cookie as X-XSRF-TOKEN with a JSON body", async () => {
    stubBrowser("theme=dark; XSRF-TOKEN=tok-123");
    stubFetch(201, { id: "0b9e7c52", status: "DRAFT" });

    await createBrandProduct(body);

    expect(fetch).toHaveBeenCalledWith(
      "/api/brand/products",
      expect.anything(),
    );
    const init = lastRequestInit();
    expect(init).toMatchObject({
      method: "POST",
      credentials: "same-origin",
      headers: {
        "X-XSRF-TOKEN": "tok-123",
        "Content-Type": "application/json",
      },
    });
    expect(JSON.parse(String(init.body))).toEqual(body);
  });

  it("uploads an image as multipart with the CSRF header", async () => {
    stubBrowser("XSRF-TOKEN=tok-123");
    stubFetch(201, { id: "6f1c2b0e", url: "/api/images/6f1c2b0e" });
    const file = new File(["png"], "photo.png", { type: "image/png" });

    await expect(uploadImage(file)).resolves.toEqual({
      id: "6f1c2b0e",
      url: "/api/images/6f1c2b0e",
    });

    const init = lastRequestInit();
    expect(init.headers).toMatchObject({ "X-XSRF-TOKEN": "tok-123" });
    expect(init.headers).not.toHaveProperty("Content-Type");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("file")).toBeInstanceOf(File);
  });

  it("keeps the field codes of the error envelope", async () => {
    stubFetch(400, {
      error: {
        code: "CARD_INVALID_PRICE_OR_PHOTO",
        message: "priceUah must be > 0",
        fields: {
          priceUah: "CARD_INVALID_PRICE_OR_PHOTO",
          productUrl: "CARD_INVALID_URL",
        },
      },
    });

    const error = await createBrandProduct(body).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: "CARD_INVALID_PRICE_OR_PHOTO",
      fields: {
        priceUah: "CARD_INVALID_PRICE_OR_PHOTO",
        productUrl: "CARD_INVALID_URL",
      },
    });
  });

  it("redirects to the brand login page when the session is missing", async () => {
    const assign = stubBrowser("", "/brand/products/new");
    stubFetch(401, {
      error: { code: "UNAUTHENTICATED", message: "No session" },
    });

    await expect(createBrandProduct(body)).rejects.toMatchObject({
      status: 401,
    });
    expect(assign).toHaveBeenCalledWith("/brand/login");
  });
});
