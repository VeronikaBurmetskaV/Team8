import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { BrandProfileResponse } from "../../api/types";
import { useBrandProfile } from "../../shared/brandProfile";
import { errorCodeOf, toFormErrors } from "../../shared/errors";
import { brandNameInvalidMessage, messages } from "../../shared/messages.uk";
import { brandNameSchema, type BrandNameForm } from "../../shared/validation";
import { useSaveBrandProfile } from "./api";
import styles from "./BrandProfilePage.module.css";

/** Request field of PUT /api/brand/profile → the input that shows its error. */
const profileFields = { name: "name" } as const;

export function BrandProfilePage() {
  const profile = useBrandProfile();

  return (
    <>
      <h1 className={styles.title}>Профіль бренду</h1>
      {profile.isPending && <p>Завантаження…</p>}
      {profile.isError && <LoadError error={profile.error} />}
      {profile.isSuccess && <BrandProfileForm profile={profile.data} />}
    </>
  );
}

function LoadError({ error }: { error: unknown }) {
  const code = errorCodeOf(error);
  // No session: the API client is already redirecting to /brand/login (US-21.1 CL).
  if (code === "UNAUTHENTICATED") return null;
  return <p role="alert">{messages[code]}</p>;
}

function BrandProfileForm({ profile }: { profile: BrandProfileResponse }) {
  const saveProfile = useSaveBrandProfile();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<BrandNameForm>({
    resolver: zodResolver(brandNameSchema),
    defaultValues: { name: profile.name ?? "" },
  });

  async function onSubmit({ name }: BrandNameForm) {
    try {
      const saved = await saveProfile.mutateAsync({
        name,
        // Only the name is edited here: the logo and the consent are sent back as loaded.
        logoImageId: profile.logoImageId,
        logoUrl: profile.logoUrl,
        consentGiven: profile.consentGiven,
      });
      // Show the name exactly as the server saved it (trimmed).
      reset({ name: saved.name ?? "" });
    } catch (error) {
      // The entered name stays in the field.
      showError(error);
    }
  }

  function showError(error: unknown) {
    const { fields, form } = toFormErrors(error, profileFields);
    if (fields.name) {
      // PROFILE_INVALID on the name gets the name-only hint; any other code keeps its own text.
      const message =
        fields.name === "PROFILE_INVALID"
          ? brandNameInvalidMessage
          : messages[fields.name];
      setError("name", { message });
    }
    if (form) setError("root", { message: messages[form] });
  }

  return (
    <form className={styles.card} onSubmit={handleSubmit(onSubmit)} noValidate>
      <div>
        <label htmlFor="name">Назва бренду</label>
        <input
          id="name"
          type="text"
          autoComplete="organization"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "name-error" : undefined}
          {...register("name")}
        />
        {errors.name && (
          <p id="name-error" role="alert">
            {errors.name.message}
          </p>
        )}
      </div>
      <button className={styles.submit} type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Зберігаємо…" : "Зберегти профіль"}
      </button>
      {errors.root && (
        <p className={styles.error} role="alert">
          {errors.root.message}
        </p>
      )}
      {saveProfile.isSuccess && !isDirty && (
        <p className={styles.success} role="status">
          Профіль збережено
        </p>
      )}
    </form>
  );
}
