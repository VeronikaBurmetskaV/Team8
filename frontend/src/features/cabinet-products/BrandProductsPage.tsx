import { useState } from "react";
import type { BrandCard } from "../../api/types";
import { useBrandProfile } from "../../shared/brandProfile";
import { AddProductEntry } from "./AddProductEntry";
import { LoadError } from "./LoadError";
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

export function BrandProductsPage() {
  const products = useBrandProducts();
  const profile = useBrandProfile();

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Товари бренду</h1>
        <AddProductEntry
          profileState={profile.data?.state ?? null}
          size="medium"
        />
      </div>

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
                <td className={styles.photo}>
                  <Thumbnail card={card} />
                </td>
                <td className={styles.name}>{card.name}</td>
                <td className={styles.price}>{card.priceUah} грн</td>
                <td className={styles.status}>{statusText[card.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
