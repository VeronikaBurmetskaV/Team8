import { useParams } from "react-router";
import { EditProductForm } from "./EditProductForm";
import { NewProductForm } from "./NewProductForm";

// `/brand/products/new` creates a card, any other id edits one (overview Q-09).
export function BrandProductPage() {
  const { id } = useParams();
  if (id === undefined || id === "new") return <NewProductForm />;
  return <EditProductForm id={id} />;
}
