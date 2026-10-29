import { useParams } from "react-router";

// `/brand/products/new` creates a card, any other id edits one (overview Q-09).
export function BrandProductPage() {
  const { id } = useParams();
  return <h1>{id === "new" ? "Новий товар" : "Редагування товару"}</h1>;
}
