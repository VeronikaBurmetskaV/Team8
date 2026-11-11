import { useState } from "react";
import { Link } from "react-router";
import type { BrandCard } from "../../api/types";
import { errorText } from "../../shared/messages.uk";
import { useBrandProducts } from "./queries";

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
    return <span>Фото недоступне</span>;
  }
  return (
    <img src={card.photoUrl} alt={card.name} onError={() => setFailed(true)} />
  );
}

export function BrandProductsPage() {
  const products = useBrandProducts();

  return (
    <section>
      <h1>Товари бренду</h1>

      {products.isPending && <p>Завантаження…</p>}

      {products.isError && (
        <div role="alert">
          <p>{errorText(products.error.message)}</p>
          <button type="button" onClick={() => void products.refetch()}>
            Спробувати ще раз
          </button>
        </div>
      )}

      {products.isSuccess && (
        <>
          {products.data.length === 0 && <p>У вас поки немає товарів</p>}
          <Link to="/brand/products/new">Додати товар</Link>
        </>
      )}

      {products.isSuccess && products.data.length > 0 && (
        <table>
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
                <td>{card.name}</td>
                <td>{card.priceUah} грн</td>
                <td>{statusText[card.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
