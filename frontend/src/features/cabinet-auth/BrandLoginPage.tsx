import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { errorMessage } from "../../shared/errors";
import { brandLoginSchema, type BrandLoginForm } from "../../shared/validation";
import { useLoginBrand } from "./api";
import { pathAfterLogin } from "./pathAfterLogin";
import styles from "./BrandLoginPage.module.css";

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
      navigate(pathAfterLogin(brand.profileState));
    } catch (error) {
      // The entered email stays in the form (US-21.1 S2).
      setError("root", { message: errorMessage(error) });
    }
  }

  // One common message, never under a field: no hint which one is wrong (US-21.1 CL).
  const errorText =
    errors.email?.message ?? errors.password?.message ?? errors.root?.message;

  return (
    <>
      <h1 className={styles.title}>Вхід для бренду</h1>
      <form
        className={styles.card}
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
        <div className={styles.field}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register("email")}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="password">Пароль</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register("password")}
          />
        </div>
        <button className={styles.submit} type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Входимо…" : "Увійти"}
        </button>
        {errorText && (
          <p className={styles.error} role="alert">
            {errorText}
          </p>
        )}
      </form>
      <p className={styles.switch}>
        Ще не маєте кабінету?{" "}
        <Link to="/brand/register">Зареєструвати бренд</Link>
      </p>
    </>
  );
}
