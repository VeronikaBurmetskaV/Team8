import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ApiError } from "../../api/client";
import type { BrandProfileResponse } from "../../api/types";
import { brandNameInvalidMessage, messages } from "../../shared/messages.uk";
import { brandNameSchema, type BrandNameForm } from "../../shared/validation";
import { useBrandProfile, useSaveBrandProfile } from "./api";

export function BrandProfilePage() {
  const profile = useBrandProfile();

  return (
    <>
      <h1>Профіль бренду</h1>
      {profile.isPending && <p>Завантаження…</p>}
      {profile.isError && <LoadError error={profile.error} />}
      {profile.isSuccess && <BrandProfileForm profile={profile.data} />}
    </>
  );
}

function LoadError({ error }: { error: unknown }) {
  // No session: the API client is already redirecting to /brand/login (US-21.1 CL).
  if (error instanceof ApiError && error.code === "UNAUTHENTICATED") {
    return null;
  }
  const code = error instanceof ApiError ? error.code : "SERVICE_UNAVAILABLE";
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
    if (!(error instanceof ApiError)) {
      setError("root", { message: messages.SERVICE_UNAVAILABLE });
      return;
    }
    const nameCode = error.fields.name;
    if (nameCode) {
      // PROFILE_INVALID on the name gets the name-only hint; any other code keeps its own text.
      const message =
        nameCode === "PROFILE_INVALID"
          ? brandNameInvalidMessage
          : messages[nameCode];
      setError("name", { message });
    } else {
      setError("root", { message: messages[error.code] });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
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
      {errors.root && <p role="alert">{errors.root.message}</p>}
      {saveProfile.isSuccess && !isDirty && (
        <p role="status">Профіль збережено</p>
      )}
      <button type="submit" disabled={isSubmitting}>
        Зберегти профіль
      </button>
    </form>
  );
}
