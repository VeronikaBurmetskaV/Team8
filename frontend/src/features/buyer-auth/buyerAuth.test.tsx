import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { ApiError } from "../../api/client";
import { buyerAuthTexts, messages } from "../../shared/messages.uk";
import {
  loginBuyer,
  registerBuyer,
  registerErrors,
  submitRegistration,
} from "./api";
import { BuyerRegisterPage } from "./BuyerRegisterPage";
import { zodResolver } from "@hookform/resolvers/zod";
import { buyerRegisterSchema } from "../../shared/validation";

afterEach(() => {
  vi.unstubAllGlobals();
});

const credentials = {
  name: "Софія",
  email: "buyer@mail.com",
  password: "password1",
};

describe("buyer login while the backend has no /api/buyer/login", () => {
  it("answers «скоро запрацює» without any request", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(loginBuyer(credentials)).resolves.toEqual({ status: "soon" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("has the agreed text for that answer", () => {
    expect(buyerAuthTexts.loginSoon).toBe(
      "Вхід для покупців скоро запрацює. Поки що ти можеш свайпати й зберігати вподобане без акаунта.",
    );
  });
});

const registration = {
  name: "Софія",
  login: "buyer@mail.com",
  password: "password1",
};

describe("POST /api/buyer/register", () => {
  it("sends only name, login and password as JSON", async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            email: "buyer@mail.com",
            phone: null,
            name: "Софія",
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchSpy);
    // The form values also hold «Підтвердити пароль»; it must not be sent.
    const formValues = {
      name: " Софія ",
      login: "0671234567",
      password: "password1",
      confirmPassword: "password1",
    };
    await registerBuyer(formValues);

    const [path, init] = fetchSpy.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(path).toBe("/api/buyer/register");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      name: "Софія",
      login: "0671234567",
      password: "password1",
    });
  });
});

describe("submitRegistration", () => {
  it("goes to the home page / after success", async () => {
    const send = vi.fn(() => Promise.resolve({ email: registration.login }));
    await expect(submitRegistration(registration, send)).resolves.toEqual({
      ok: true,
      next: "/",
    });
    expect(send).toHaveBeenCalledWith(registration);
  });

  it("puts a taken email or phone (409) under the login field, with one neutral text", async () => {
    const send = () =>
      Promise.reject(
        new ApiError(409, "EMAIL_TAKEN_OR_INVALID", {
          login: "EMAIL_TAKEN_OR_INVALID",
        }),
      );
    await expect(submitRegistration(registration, send)).resolves.toEqual({
      ok: false,
      errors: { login: buyerAuthTexts.loginTaken },
    });
  });
});

describe("registerErrors", () => {
  it("shows LOGIN_INVALID under «Email або номер телефону»", () => {
    expect(
      registerErrors(
        new ApiError(400, "LOGIN_INVALID", { login: "LOGIN_INVALID" }),
      ),
    ).toEqual({ login: "Введіть email або номер телефону у форматі +380…" });
    expect(registerErrors(new ApiError(400, "LOGIN_INVALID"))).toEqual({
      login: buyerAuthTexts.loginInvalid,
    });
  });

  it("shows a wrong name under «Імʼя»", () => {
    expect(
      registerErrors(
        new ApiError(400, "VALIDATION_FAILED", { name: "VALIDATION_FAILED" }),
      ),
    ).toEqual({ name: buyerAuthTexts.nameInvalid });
  });

  it("shows PASSWORD_TOO_SHORT under «Пароль»", () => {
    expect(registerErrors(new ApiError(400, "PASSWORD_TOO_SHORT"))).toEqual({
      password: messages.PASSWORD_TOO_SHORT,
    });
    expect(
      registerErrors(
        new ApiError(400, "PASSWORD_TOO_SHORT", {
          password: "PASSWORD_TOO_SHORT",
        }),
      ),
    ).toEqual({ password: messages.PASSWORD_TOO_SHORT });
  });

  it("shows 429 as one common message", () => {
    expect(registerErrors(new ApiError(429, "TOO_MANY_REQUESTS"))).toEqual({
      form: "Забагато спроб, спробуйте пізніше",
    });
  });

  it("shows a network failure as one common message", () => {
    const expected = { form: "Не вдалося з'єднатися, спробуйте ще раз" };
    expect(registerErrors(new TypeError("Failed to fetch"))).toEqual(expected);
    expect(registerErrors(new ApiError(502, "SERVICE_UNAVAILABLE"))).toEqual(
      expected,
    );
  });

  it("never shows a raw server text", () => {
    const errors = registerErrors(new ApiError(403, "FORBIDDEN"));
    expect(errors).toEqual({ form: messages.FORBIDDEN });
  });
});

describe("the name is required: nothing is sent without it", () => {
  const resolver = zodResolver(buyerRegisterSchema);
  const form = {
    login: "buyer@mail.com",
    password: "password1",
    confirmPassword: "password1",
  };

  it.each(["", "   "])(
    "name %j: «Введіть імʼя» and the form does not submit",
    async (name) => {
      // react-hook-form calls onSubmit (and so the request) only when the resolver has no errors
      const result = await resolver({ ...form, name }, undefined, {
        fields: {},
        shouldUseNativeValidation: false,
      });
      expect(result.errors.name?.message).toBe("Введіть імʼя");
      expect(result.values).toEqual({});
    },
  );

  it("a name passes and is trimmed", async () => {
    const result = await resolver({ ...form, name: "  Софія " }, undefined, {
      fields: {},
      shouldUseNativeValidation: false,
    });
    expect(result.errors).toEqual({});
    expect(result.values).toMatchObject({ name: "Софія" });
  });
});

function renderRegister(): string {
  return renderToString(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/register"]}>
        <BuyerRegisterPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("/register", () => {
  it("renders the form with labels, autocomplete and the length hint", () => {
    const html = renderRegister();
    expect(html).toContain("<h1");
    // the optional name first, then one field for email or phone
    const order = [
      "register-name",
      "register-login",
      "register-password",
      "register-confirm",
    ].map((id) => html.indexOf(`for="${id}"`));
    expect(order.every((index) => index > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toMatch(/<label[^>]*for="register-name"[^>]*>Імʼя<\/label>/);
    expect(html).toMatch(
      /<input[^>]*id="register-name"[^>]*autoComplete="given-name"/i,
    );
    expect(html).toMatch(
      /<label[^>]*for="register-login"[^>]*>Email або номер телефону<\/label>/,
    );
    const login = html.match(/<input[^>]*id="register-login"[^>]*>/)?.[0] ?? "";
    expect(login).toMatch(/autoComplete="username"/i);
    expect(login).toMatch(/inputMode="email"/i);
    expect(html).toMatch(
      /<label[^>]*for="register-confirm"[^>]*>Підтвердити пароль<\/label>/,
    );
    // the new small print under the button: its own smaller class, not the footer's
    expect(html).toMatch(
      /<p class="[^"]*_note[^"]*">Ми зберігаємо вашу пошту та вподобані товари<\/p>/,
    );
    expect(html.match(/autoComplete="new-password"/gi)).toHaveLength(2);
    expect(html).toContain("Мінімум 8 символів");
    expect(html).toMatch(
      /id="register-password"[^>]*aria-describedby="register-password-hint"|aria-describedby="register-password-hint"[^>]*id="register-password"/,
    );
    expect(html).toMatch(
      /<button[^>]*type="submit"[^>]*>Створити акаунт<\/button>/,
    );
  });

  it("links to /login", () => {
    expect(renderRegister()).toMatch(
      /Вже є акаунт\?.*<a[^>]*href="\/login"[^>]*>Увійти<\/a>/s,
    );
  });
});
