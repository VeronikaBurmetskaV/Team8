import { useState } from "react";
import { Link } from "react-router";
import type { BrandCard } from "../../api/types";
import { useBrandProfile } from "../../shared/brandProfile";
import { errorCodeOf } from "../../shared/errors";
import { messages } from "../../shared/messages.uk";
import { useBrandProducts } from "./queries";
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

/**
 * «Додати товар», or a hint with the way to the profile while the brand has no name:
 * the entry is hidden for an INCOMPLETE profile (api.md §3.2 PROFILE_INCOMPLETE, US-22.1 CL).
 * The server still answers 409 if the form is opened anyway.
 */
function AddProductEntry() {
  const profile = useBrandProfile();
  if (profile.isPending) return null;
  if (profile.data?.state === "INCOMPLETE") {
    return (
      <p className={styles.hint}>
        {messages.PROFILE_INCOMPLETE}{" "}
        <Link to="/brand/profile">Заповнити профіль бренду</Link>
      </p>
    );
  }
  return (
    <Link className={styles.addLink} to="/brand/products/new">
      Додати товар
    </Link>
  );
}

function LoadError({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  const code = errorCodeOf(error);
  // No session: the API client is already redirecting to /brand/login (US-21.1 CL).
  if (code === "UNAUTHENTICATED") return null;
  return (
    <div className={styles.loadError} role="alert">
      <p>{messages[code]}</p>
      <button type="button" onClick={onRetry}>
        Спробувати ще раз
      </button>
    </div>
  );
}

export function BrandProductsPage() {
  const products = useBrandProducts();

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Товари бренду</h1>

      <AddProductEntry />

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
            </tr>
          </thead>
          <tbody>
            {products.data.map((card) => (
              <tr key={card.id}>
                <td>
                  <Thumbnail card={card} />
                </td>
                <td className={styles.name}>{card.name}</td>
                <td className={styles.price}>{card.priceUah} грн</td>
                <td>{statusText[card.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
