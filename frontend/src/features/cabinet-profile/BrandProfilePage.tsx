import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { BrandProfileResponse } from "../../api/types";
import { useBrandProfile } from "../../shared/brandProfile";
import { errorCodeOf, toFormErrors } from "../../shared/errors";
import { brandNameInvalidMessage, messages } from "../../shared/messages.uk";
import { useSaveBrandProfile } from "./api";
import styles from "./BrandProfilePage.module.css";
import {
  brandProfileFormSchema,
  CONSENT_TEXT,
  profileFields,
  toBrandProfileFormValues,
  toBrandProfileRequest,
  type BrandProfileForm,
} from "./profileForm";

export function BrandProfilePage() {
  const profile = useBrandProfile();

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Профіль бренду</h1>
      {profile.isPending && <p>Завантаження…</p>}
      {profile.isError && <LoadError error={profile.error} />}
      {profile.isSuccess && <BrandProfileForm profile={profile.data} />}
    </div>
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
  } = useForm<BrandProfileForm>({
    resolver: zodResolver(brandProfileFormSchema),
    defaultValues: toBrandProfileFormValues(profile),
  });
  // Locked only by the server's answer (the query cache), never by the ticked box (INV-09).
  const consentLocked = profile.consentGiven;

  async function onSubmit(values: BrandProfileForm) {
    try {
      const saved = await saveProfile.mutateAsync(
        toBrandProfileRequest(values, profile),
      );
      // Show the profile exactly as the server saved it: the trimmed name and the real consent.
      reset(toBrandProfileFormValues(saved));
    } catch (error) {
      // The entered name and the checkbox stay as they are.
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
    if (fields.consentGiven) {
      setError("consentGiven", { message: messages[fields.consentGiven] });
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
      <div>
        {/* The box sits inside its label, so the global styles put them on one line. */}
        <label>
          {consentLocked ? (
            // Saved consent cannot be withdrawn by the brand: shown, not part of the form.
            <input type="checkbox" checked disabled readOnly />
          ) : (
            <input
              type="checkbox"
              disabled={isSubmitting}
              aria-invalid={errors.consentGiven ? true : undefined}
              aria-describedby={
                errors.consentGiven ? "consentGiven-error" : undefined
              }
              {...register("consentGiven")}
            />
          )}{" "}
          {CONSENT_TEXT}
        </label>
        {errors.consentGiven && (
          <p id="consentGiven-error" role="alert">
            {errors.consentGiven.message}
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
