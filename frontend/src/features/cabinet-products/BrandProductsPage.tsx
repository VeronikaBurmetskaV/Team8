import { useState } from "react";
import { Link } from "react-router";
import type { BrandCard } from "../../api/types";
import { useBrandProfile } from "../../shared/brandProfile";
import { errorCodeOf } from "../../shared/errors";
import { messages, publishTexts } from "../../shared/messages.uk";
import { AddProductEntry } from "./AddProductEntry";
import { LoadError } from "./LoadError";
import { publishGate } from "./publishGate";
import {
  useBrandProducts,
  usePublishBrandProduct,
  usePublishingIds,
} from "./queries";
import styles from "./BrandProductsPage.module.css";

const statusText: Record<BrandCard["status"], string> = {
  DRAFT: "Чернетка",
  PUBLISHED: "Опубліковано",
};

/** Only the two photo sources of the contract ever reach `src`. */
function isSafePhotoUrl(url: string): boolean {
  return url.startsWith("/api/images/") || url.startsWith("https://");
}

function Thumbnail({ card }: { card: BrandCard }) {
  const [failed, setFailed] = useState(false);
  if (failed || !isSafePhotoUrl(card.photoUrl)) {
    return <span className={styles.placeholder}>Фото недоступне</span>;
  }
  return (
    <img
      className={styles.thumbnail}
      src={card.photoUrl}
      alt={card.name}
      onError={() => setFailed(true)}
    />
  );
}

const consentHintId = "publish-consent-hint";

export function BrandProductsPage() {
  const products = useBrandProducts();
  const profile = useBrandProfile();
  const publish = usePublishBrandProduct();
  const publishingIds = usePublishingIds();
  // The last failed publish per card, shown in its row until the next try.
  const [publishErrors, setPublishErrors] = useState<Record<string, unknown>>(
    {},
  );

  const profileState = profile.data?.state ?? null;
  const showConsentHint =
    products.isSuccess &&
    products.data.some(
      (card) => publishGate(card, profileState).kind === "consentRequired",
    );

  function setPublishError(id: string, error: unknown) {
    setPublishErrors((errors) => {
      const next = { ...errors };
      if (error === undefined) delete next[id];
      else next[id] = error;
      return next;
    });
  }

  function onPublish(id: string) {
    setPublishError(id, undefined);
    publish.mutate(id, { onError: (error) => setPublishError(id, error) });
  }

  /** The text under a row's button, or null when the page already explains the outcome. */
  function publishErrorText(id: string): string | null {
    if (!Object.hasOwn(publishErrors, id)) return null;
    const code = errorCodeOf(publishErrors[id]);
    // UNAUTHENTICATED: the client is redirecting to the login page.
    // INVALID_STATE: no text in the contract, the refetched list shows the real status.
    // CONSENT_REQUIRED: the hint above the table already says it.
    if (code === "UNAUTHENTICATED" || code === "INVALID_STATE") return null;
    if (code === "CONSENT_REQUIRED" && showConsentHint) return null;
    return messages[code];
  }

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Товари бренду</h1>
        <AddProductEntry profileState={profileState} size="medium" />
      </div>

      {showConsentHint && (
        <p id={consentHintId} className={styles.consentHint}>
          {messages.CONSENT_REQUIRED}{" "}
          <Link to="/brand/profile">{publishTexts.toProfile}</Link>
        </p>
      )}

      {products.isPending && <p>Завантаження…</p>}

      {products.isError && (
        <LoadError
          error={products.error}
          onRetry={() => void products.refetch()}
        />
      )}

      {products.isSuccess && products.data.length === 0 && (
        <p className={styles.empty}>У вас поки немає товарів</p>
      )}

      {products.isSuccess && products.data.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Фото</th>
              <th scope="col">Назва</th>
              <th scope="col">Ціна</th>
              <th scope="col">Статус</th>
              <th scope="col">{publishTexts.actions}</th>
            </tr>
          </thead>
          <tbody>
            {products.data.map((card) => {
              const gate = publishGate(card, profileState);
              const busy = publishingIds.includes(card.id);
              const errorText = publishErrorText(card.id);
              return (
                <tr key={card.id}>
                  <td className={styles.photo}>
                    <Thumbnail card={card} />
                  </td>
                  <td className={styles.name}>{card.name}</td>
                  <td className={styles.price}>{card.priceUah} грн</td>
                  <td className={styles.status}>{statusText[card.status]}</td>
                  <td className={styles.actions}>
                    {gate.kind !== "hidden" && (
                      <button
                        type="button"
                        className={styles.publish}
                        disabled={gate.kind !== "ready" || busy}
                        aria-busy={busy || undefined}
                        aria-describedby={
                          gate.kind === "consentRequired"
                            ? consentHintId
                            : undefined
                        }
                        onClick={() => onPublish(card.id)}
                      >
                        {publishTexts.publish}
                      </button>
                    )}
                    {errorText !== null && <p role="alert">{errorText}</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
