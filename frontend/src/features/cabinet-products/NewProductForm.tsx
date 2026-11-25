import { useNavigate } from "react-router";
import { ProductForm } from "./ProductForm";
import { useCreateBrandProduct } from "./queries";

/** /brand/products/new: creates a Draft (US-25.1, US-26). */
export function NewProductForm() {
  const navigate = useNavigate();
  const createProduct = useCreateBrandProduct();
  return (
    <ProductForm
      title="Новий товар"
      submitLabel="Зберегти чернетку"
      defaultValues={{
        name: "",
        priceUah: "",
        photo: { file: null, url: "" },
        productUrl: "",
      }}
      onSave={async (values) => {
        await createProduct.mutateAsync(values);
        await navigate("/brand/products");
      }}
    />
  );
}
