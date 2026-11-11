import { useParams } from "react-router";
import { NewProductForm } from "./NewProductForm";

// `/brand/products/new` creates a card, any other id edits one (overview Q-09).
export function BrandProductPage() {
  const { id } = useParams();
  if (id === "new") return <NewProductForm />;
  return <h1>Редагування товару</h1>;
}
