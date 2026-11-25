import { Link, useNavigate } from "react-router";
import type { BrandCard } from "../../api/types";
import { editProductTexts as t } from "../../shared/messages.uk";
import { editCardFormSchema } from "../../shared/validation";
import { LoadError } from "./LoadError";
import { ProductForm } from "./ProductForm";
import { toCardFormValues } from "./productList";
import { useBrandProducts, useUpdateBrandProduct } from "./queries";
import styles from "./NewProductForm.module.css";

/**
 * /brand/products/:id: edits a Draft (US-26 S1). Imported cards (ADR-0017) are edited the same
 * way; the fields the brand changes are marked and later imports keep them. A Published card is
 * read-only (409 CARD_NOT_EDITABLE): the form is not shown.
 */
export function EditProductForm({ id }: { id: string }) {
  const products = useBrandProducts();
  if (products.isPending) return <p>Завантаження…</p>;
  if (products.isError) {
    return (
      <LoadError
        error={products.error}
        onRetry={() => void products.refetch()}
      />
    );
  }
  const card = products.data.find((item) => item.id === id);
  return <EditProductView card={card} />;
}

/** The editor for a loaded card (exported for tests). */
export function EditProductView({ card }: { card: BrandCard | undefined }) {
  const navigate = useNavigate();
  const update = useUpdateBrandProduct(card);

  if (card === undefined || card.status === "PUBLISHED") {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>{t.title}</h1>
        <p role="status">
          {card === undefined ? t.notFound : t.publishedReadOnly}
        </p>
        <Link className={styles.backLink} to="/brand/products">
          До списку товарів
        </Link>
      </section>
    );
  }

  const keepsUploadedPhoto = card.photoImageId !== null;
  return (
    <ProductForm
      title={t.title}
      submitLabel={t.save}
      defaultValues={toCardFormValues(card)}
      schema={editCardFormSchema(keepsUploadedPhoto)}
      editedFields={card.editedFields ?? []}
      note={card.sourceUrl !== undefined ? t.importedNote : undefined}
      photoHint={keepsUploadedPhoto ? t.keepPhoto : undefined}
      onSave={async (values) => {
        await update.mutateAsync(values);
        await navigate("/brand/products");
      }}
    />
  );
}
