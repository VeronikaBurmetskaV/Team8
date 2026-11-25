import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { BrandProfileResponse } from "../../api/types";
import { useBrandProfile } from "../../shared/brandProfile";
import { ConfirmDialog } from "../../shared/ConfirmDialog";
import { formatConsentDate } from "../../shared/consentDate";
import { errorCodeOf, errorMessage } from "../../shared/errors";
import { confirmTexts, messages } from "../../shared/messages.uk";
import { cleanWebsiteUrl } from "../../shared/validation";
import { useSaveBrandProfile } from "./api";
import styles from "./BrandProfilePage.module.css";
import {
  consentCheckbox,
  consentTransition,
  toConsentRequest,
  type ConsentEvent,
  type ConsentStep,
} from "./consent";
import {
  brandProfileFormSchema,
  CONSENT_TEXT,
  profileSaveErrors,
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
  // No session: the API client is already redirecting to /login?tab=brand (US-21.1 CL).
  if (code === "UNAUTHENTICATED") return null;
  return <p role="alert">{messages[code]}</p>;
}

function BrandProfileForm({ profile }: { profile: BrandProfileResponse }) {
  const saveProfile = useSaveBrandProfile();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<BrandProfileForm>({
    resolver: zodResolver(brandProfileFormSchema),
    defaultValues: toBrandProfileFormValues(profile),
  });

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
    const texts = profileSaveErrors(error);
    if (texts.name) setError("name", { message: texts.name });
    if (texts.websiteUrl) setError("websiteUrl", { message: texts.websiteUrl });
    if (texts.consentGiven) {
      setError("consentGiven", { message: texts.consentGiven });
    }
    if (texts.form) setError("root", { message: texts.form });
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
        <label htmlFor="websiteUrl">Сайт бренду</label>
        <input
          id="websiteUrl"
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="https://brand.com.ua"
          aria-invalid={errors.websiteUrl ? true : undefined}
          aria-describedby={errors.websiteUrl ? "websiteUrl-error" : undefined}
          {...register("websiteUrl", {
            // On blur: «brand.com.ua» → «https://brand.com.ua», and tracking parameters
            // (srsltid, utm_*, fbclid, gclid) are removed, so the field shows what is saved.
            onBlur: (event: { target: { value: string } }) => {
              const value = cleanWebsiteUrl(event.target.value);
              if (value !== event.target.value) {
                setValue("websiteUrl", value, { shouldDirty: true });
              }
            },
          })}
        />
        {errors.websiteUrl && (
          <p id="websiteUrl-error" role="alert">
            {errors.websiteUrl.message}
          </p>
        )}
      </div>
      <ConsentField profile={profile} />
      {errors.consentGiven && (
        <p id="consentGiven-error" role="alert">
          {errors.consentGiven.message}
        </p>
      )}
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

/**
 * The consent checkbox (US-22.2). Ticking asks for confirmation first; «Підтвердити» saves the
 * consent at once, without «Зберегти профіль». The box is locked only by the server's answer
 * (the query cache), so after a reload it is still ticked and disabled (INV-09).
 */
function ConsentField({ profile }: { profile: BrandProfileResponse }) {
  const saveConsent = useSaveBrandProfile();
  const [step, setStep] = useState<ConsentStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const box = consentCheckbox(profile, step);
  // «Підтвердити згоду» on /brand leads here as /brand/profile#consent: scroll to the box and
  // focus it, so the next Space ticks it.
  const { hash } = useLocation();
  const boxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (hash !== "#consent") return;
    boxRef.current?.scrollIntoView({ block: "center" });
    boxRef.current?.focus({ preventScroll: true });
  }, [hash]);

  function send(event: ConsentEvent): boolean {
    const next = consentTransition(step, event, profile);
    setStep(next.step);
    return next.save;
  }

  function finish(event: "saveSucceeded" | "saveFailed") {
    setStep((current) => consentTransition(current, event, profile).step);
  }

  function confirm() {
    if (!send("confirm")) return;
    setError(null);
    saveConsent.mutate(toConsentRequest(profile), {
      onSuccess: () => finish("saveSucceeded"),
      onError: (saveError) => {
        finish("saveFailed");
        setError(errorMessage(saveError));
      },
    });
  }

  return (
    <div className={styles.consent} id="consent">
      {/* The box sits inside its label, so the global styles put them on one line. */}
      <label>
        <input
          ref={boxRef}
          type="checkbox"
          checked={box.checked}
          disabled={box.disabled}
          aria-describedby="consent-status"
          onChange={(event) => {
            if (event.target.checked) send("tick");
          }}
        />{" "}
        {CONSENT_TEXT}
      </label>
      <p id="consent-status" className={styles.consentStatus} role="status">
        {profile.consentGiven && profile.consentGivenAt !== null
          ? confirmTexts.consentGivenOn(
              formatConsentDate(profile.consentGivenAt),
            )
          : step === "saving"
            ? confirmTexts.consentSaving
            : profile.name === null
              ? confirmTexts.consentNeedsName
              : null}
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={step === "confirming"}
        title={confirmTexts.consentQuestion}
        confirmLabel={confirmTexts.consentConfirm}
        onConfirm={confirm}
        onCancel={() => send("cancel")}
      />
    </div>
  );
}
