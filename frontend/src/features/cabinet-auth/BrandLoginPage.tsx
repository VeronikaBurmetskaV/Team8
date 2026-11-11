import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { ApiError } from "../../api/client";
import { messages } from "../../shared/messages.uk";
import { brandLoginSchema, type BrandLoginForm } from "../../shared/validation";
import { useLoginBrand } from "./api";

export function BrandLoginPage() {
  const navigate = useNavigate();
  const loginBrand = useLoginBrand();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BrandLoginForm>({
    resolver: zodResolver(brandLoginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(credentials: BrandLoginForm) {
    try {
      const brand = await loginBrand.mutateAsync(credentials);
      // The profile first while the brand has no name, otherwise the products (US-21.1 CL).
      navigate(
        brand.profileState === "INCOMPLETE"
          ? "/brand/profile"
          : "/brand/products",
      );
    } catch (error) {
      // The entered email stays in the form (US-21.1 S2).
      const code =
        error instanceof ApiError ? error.code : "SERVICE_UNAVAILABLE";
      setError("root", { message: messages[code] });
    }
  }

  // One common message, never under a field: no hint which one is wrong (US-21.1 CL).
  const errorText =
    errors.email?.message ?? errors.password?.message ?? errors.root?.message;

  return (
    <>
      <h1>Вхід для бренду</h1>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register("email")}
          />
        </div>
        <div>
          <label htmlFor="password">Пароль</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register("password")}
          />
        </div>
        {errorText && <p role="alert">{errorText}</p>}
        <button type="submit" disabled={isSubmitting}>
          Увійти
        </button>
      </form>
    </>
  );
}
