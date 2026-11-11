import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, createBrandProduct, getHealth, uploadImage } from "./client";

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

describe("POST helpers", () => {
  const body = {
    name: "Лляна сукня міді",
    priceUah: 2400,
    photoImageId: null,
    photoUrl: "https://cdn.brand-site.ua/dress.webp",
    productUrl: "https://brand-site.ua/linen-dress",
  };

  function lastRequestInit(): RequestInit {
    const init = vi.mocked(fetch).mock.calls[0]?.[1];
    if (!init) throw new Error("fetch was not called with options");
    return init;
  }

  it("sends the XSRF-TOKEN cookie as X-XSRF-TOKEN with a JSON body", async () => {
    vi.stubGlobal("document", { cookie: "theme=dark; XSRF-TOKEN=tok-123" });
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
    vi.stubGlobal("document", { cookie: "XSRF-TOKEN=tok-123" });
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
    const assign = vi.fn();
    vi.stubGlobal("window", {
      location: { pathname: "/brand/products/new", assign },
    });
    stubFetch(401, {
      error: { code: "UNAUTHENTICATED", message: "No session" },
    });

    await expect(createBrandProduct(body)).rejects.toMatchObject({
      status: 401,
    });
    expect(assign).toHaveBeenCalledWith("/brand/login");
  });
});
